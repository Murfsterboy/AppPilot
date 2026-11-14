package com.apppilot.launcher

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Build
import android.text.TextPaint
import android.text.TextUtils
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * A plain text list that magnifies the rows around your finger, like the macOS Dock.
 *
 * How it stays smooth:
 *  - Everything is drawn directly on a Canvas (no child views, no layout passes while scrubbing).
 *  - The finger position is mapped to a fractional row index using the *unmagnified* layout, so the
 *    magnification can never feed back into which row is selected (no jitter).
 *  - Row sizes follow a Gaussian curve around that index. The magnified layout is then shifted so the
 *    point under the finger stays exactly under the finger, so rows grow out from it rather than jumping.
 *  - Magnification fades in/out and follows the finger with frame-rate independent easing on
 *    postInvalidateOnAnimation, so it runs at the display's refresh rate (90/120 Hz where available).
 *  - No allocations in onDraw apart from cached ellipsized labels.
 */
class MagnifyListView(context: Context) : View(context) {

    class Item(val label: String, val icon: Bitmap?)

    interface Listener {
        fun onItemClick(index: Int, bounds: Rect)
        fun onItemLongPress(index: Int)
    }

    var listener: Listener? = null

    var textColor = Color.WHITE
        set(v) { field = v; invalidate() }
    var highlightColor = Color.CYAN
        set(v) { field = v; invalidate() }
    var baseTextSizePx = sp(17f)
        set(v) { field = v; clearCache(); updateGestureExclusion(); invalidate() }
    var maxScale = 2.3f
        set(v) { field = v.coerceAtLeast(1f); invalidate() }
    /** Width of the magnification bump, in rows. */
    var spread = 1.3f
        set(v) { field = v.coerceAtLeast(0.3f); invalidate() }
    var showIcons = false
        set(v) { field = v; clearCache(); invalidate() }
    /** true = list hugs the left edge (left-handed mode). */
    var mirrored = false
        set(v) { field = v; invalidate() }
    var pill = true
        set(v) { field = v; invalidate() }
    var haptics = true
    /** 0 = top, 0.5 = centre, 1 = bottom. */
    var verticalBias = 0.55f
        set(v) { field = v.coerceIn(0f, 1f); updateGestureExclusion(); invalidate() }

    val isTouching: Boolean get() = touching

    private var items: List<Item> = emptyList()

    // Per-row layout buffers (reused every frame).
    private var scales = FloatArray(0)
    private var rowTop = FloatArray(0)
    private var rowHeight = FloatArray(0)
    private var cum = FloatArray(1)

    // Ellipsized label cache.
    private var cacheSize = FloatArray(0)
    private var cacheAvail = FloatArray(0)
    private var cacheText = arrayOfNulls<CharSequence>(0)
    private var cacheBold = BooleanArray(0)

    private val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG)
    private val pillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val iconPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val regular = Typeface.create("sans-serif", Typeface.NORMAL)
    private val medium = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    private val tmpRect = RectF()

    // Interaction / animation state.
    private var visibleCount = 0
    private var focus = 0f          // where the finger is, as a fractional row index
    private var drawFocus = 0f      // eased towards focus
    private var strength = 0f       // 0 = flat list, 1 = fully magnified
    private var targetStrength = 0f
    private var selected = -1
    private var highlighted = -1    // stays set while magnification fades out
    private var touching = false
    private var cancelled = false
    private var moved = false
    private var longPressed = false
    private var downX = 0f
    private var downY = 0f
    private var lastFrameNanos = 0L

    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private val cancelDistance = dp(56f)
    private val longPressRunnable = Runnable {
        if (touching && !moved && selected >= 0) {
            longPressed = true
            if (haptics) performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
            val idx = selected
            release()
            listener?.onItemLongPress(idx)
        }
    }

    init {
        isHapticFeedbackEnabled = true
        contentDescription = "Most used apps"
    }

    fun setItems(newItems: List<Item>) {
        items = newItems
        val n = newItems.size
        if (scales.size < n) {
            scales = FloatArray(n); rowTop = FloatArray(n); rowHeight = FloatArray(n); cum = FloatArray(n + 1)
        }
        cacheSize = FloatArray(n); cacheAvail = FloatArray(n); cacheText = arrayOfNulls(n); cacheBold = BooleanArray(n)
        if (selected >= n) selected = -1
        if (highlighted >= n) highlighted = -1
        updateGestureExclusion()
        invalidate()
    }

    /** Snap back to the flat list immediately (e.g. when the home screen is left). */
    fun reset() {
        removeCallbacks(longPressRunnable)
        touching = false; cancelled = false
        strength = 0f; targetStrength = 0f
        selected = -1; highlighted = -1
        lastFrameNanos = 0L
        invalidate()
    }

    private fun clearCache() {
        cacheSize.fill(0f); cacheAvail.fill(0f); cacheText.fill(null)
    }

    private val slotHeight: Float get() = baseTextSizePx * 2.05f
    private val contentHeight: Float get() = (height - paddingTop - paddingBottom).toFloat()

    private fun capacity(): Int {
        if (height == 0) return 0
        // Leave room for the extra height the magnification adds (area under the Gaussian bump).
        val extra = (maxScale - 1f) * GROWTH * slotHeight * spread * 2.5066f
        return max(1, floor((contentHeight - extra * 0.6f) / slotHeight).toInt())
    }

    private fun baseTop(n: Int): Float =
        paddingTop + (contentHeight - n * slotHeight) * verticalBias

    private fun focusFor(y: Float, n: Int): Float =
        ((y - baseTop(n)) / slotHeight).coerceIn(0.5f, n - 0.5f)

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        clearCache()
        updateGestureExclusion()
    }

    /** Stop the edge "back" gesture from stealing touches that start on the list. */
    private fun updateGestureExclusion() {
        if (Build.VERSION.SDK_INT < 29 || height == 0) return
        val n = min(items.size, capacity())
        val centre = baseTop(n) + n * slotHeight / 2f
        val half = dp(100f) // the system honours at most 200dp per edge
        systemGestureExclusionRects = listOf(
            Rect(0, (centre - half).toInt(), width, (centre + half).toInt())
        )
    }

    // ------------------------------------------------------------------ drawing

    override fun onDraw(canvas: Canvas) {
        val now = System.nanoTime()
        val dt = if (lastFrameNanos == 0L) 1f / 60f
        else ((now - lastFrameNanos) / 1_000_000_000f).coerceIn(0f, 0.05f)
        lastFrameNanos = now

        strength += (targetStrength - strength) * (1f - exp(-dt * 14f))
        if (abs(targetStrength - strength) < 0.003f) strength = targetStrength
        drawFocus += (focus - drawFocus) * (1f - exp(-dt * 40f))
        if (abs(focus - drawFocus) < 0.001f) drawFocus = focus
        if (strength == 0f && !touching) highlighted = -1

        val n = min(items.size, capacity())
        visibleCount = n
        if (n > 0) {
            layoutRows(n)
            for (i in 0 until n) drawRow(canvas, i)
        }

        val animating = strength != targetStrength || drawFocus != focus
        if (animating) postInvalidateOnAnimation() else lastFrameNanos = 0L
    }

    private fun layoutRows(n: Int) {
        val h = slotHeight
        val twoSigmaSq = 2f * spread * spread
        val amp = (maxScale - 1f) * strength
        val f = drawFocus.coerceIn(0f, n.toFloat())

        cum[0] = 0f
        for (i in 0 until n) {
            val d = i + 0.5f - f
            val s = 1f + amp * exp(-(d * d) / twoSigmaSq)
            scales[i] = s
            rowHeight[i] = h * (1f + (s - 1f) * GROWTH)
            cum[i + 1] = cum[i] + rowHeight[i]
        }
        val total = cum[n]

        // Keep the point under the finger fixed: find where fractional index f lands in the
        // magnified layout, and shift everything so it lines up with the flat layout.
        val k = min(floor(f).toInt(), n - 1)
        val anchorMagnified = cum[k] + (f - k) * rowHeight[k]
        val top0 = baseTop(n)
        var shift = top0 + f * h - anchorMagnified

        val minTop = paddingTop.toFloat()
        val maxTop = height - paddingBottom - total
        var squeeze = 1f
        if (maxTop >= minTop) {
            shift = shift.coerceIn(minTop, maxTop)
        } else {
            squeeze = contentHeight / total
            shift = minTop
        }
        for (i in 0 until n) {
            rowTop[i] = shift + cum[i] * squeeze
            rowHeight[i] *= squeeze
        }
    }

    private fun drawRow(canvas: Canvas, i: Int) {
        val item = items[i]
        val s = scales[i]
        val cy = rowTop[i] + rowHeight[i] / 2f
        val weight = if (maxScale > 1.01f) ((s - 1f) / (maxScale - 1f)).coerceIn(0f, 1f) else 0f
        val isHighlighted = i == highlighted && strength > 0.01f

        textPaint.textSize = baseTextSizePx * s
        textPaint.typeface = if (isHighlighted) medium else regular
        textPaint.color = if (isHighlighted) {
            Colors.blend(textColor, highlightColor, strength)
        } else {
            // Rows far from the finger dim slightly; rows near it brighten.
            val alpha = (0.9f - 0.25f * strength + 0.35f * weight).coerceIn(0f, 1f)
            Colors.withAlpha(textColor, alpha)
        }

        val edge = if (mirrored) paddingLeft.toFloat() else (width - paddingRight).toFloat()
        val icon = if (showIcons) item.icon else null
        val iconSize = if (icon != null) baseTextSizePx * 1.45f * s else 0f
        val gap = if (icon != null) baseTextSizePx * 0.6f * s else 0f
        val anchor = if (mirrored) edge + iconSize + gap else edge - iconSize - gap
        val avail = if (mirrored) width - paddingRight - anchor else anchor - paddingLeft
        val label = fit(i, item.label, avail)
        textPaint.textAlign = if (mirrored) Paint.Align.LEFT else Paint.Align.RIGHT

        if (isHighlighted && pill) {
            val tw = textPaint.measureText(label, 0, label.length)
            val padH = baseTextSizePx * 0.55f * s
            val half = textPaint.textSize * 0.82f
            if (mirrored) tmpRect.set(edge - padH, cy - half, anchor + tw + padH, cy + half)
            else tmpRect.set(anchor - tw - padH, cy - half, edge + padH, cy + half)
            pillPaint.color = Colors.withAlpha(highlightColor, 0.18f * strength)
            canvas.drawRoundRect(tmpRect, half, half, pillPaint)
        }

        val baseline = cy - (textPaint.descent() + textPaint.ascent()) / 2f
        canvas.drawText(label, 0, label.length, anchor, baseline, textPaint)

        if (icon != null) {
            val left = if (mirrored) edge else edge - iconSize
            tmpRect.set(left, cy - iconSize / 2f, left + iconSize, cy + iconSize / 2f)
            iconPaint.alpha = (textPaint.alpha).coerceAtLeast(150)
            canvas.drawBitmap(icon, null, tmpRect, iconPaint)
        }
    }

    private fun fit(i: Int, full: String, avail: Float): CharSequence {
        if (avail <= 0f) return ""
        if (textPaint.measureText(full) <= avail) return full
        val size = textPaint.textSize
        val cached = cacheText[i]
        val bold = textPaint.typeface == medium
        if (cached != null && cacheBold[i] == bold && abs(cacheSize[i] - size) < 0.75f &&
            abs(cacheAvail[i] - avail) < 1f
        ) return cached
        val t = TextUtils.ellipsize(full, textPaint, avail, TextUtils.TruncateAt.END)
        cacheText[i] = t; cacheSize[i] = size; cacheAvail[i] = avail; cacheBold[i] = bold
        return t
    }

    // ------------------------------------------------------------------ touch

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        val n = visibleCount
        if (n == 0) return false
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                touching = true; cancelled = false; moved = false; longPressed = false
                downX = e.x; downY = e.y
                focus = focusFor(e.y, n)
                if (strength < 0.01f) drawFocus = focus
                targetStrength = 1f
                select(n, tick = false)
                parent?.requestDisallowInterceptTouchEvent(true)
                postDelayed(longPressRunnable, ViewConfiguration.getLongPressTimeout().toLong())
                lastFrameNanos = 0L
                invalidate()
            }
            MotionEvent.ACTION_MOVE -> {
                if (!touching) return true
                if (!moved && hypot(e.x - downX, e.y - downY) > touchSlop) {
                    moved = true
                    removeCallbacks(longPressRunnable)
                }
                // Dragging well away from the list sideways cancels without launching.
                val out = if (mirrored) e.x > width + cancelDistance else e.x < -cancelDistance
                if (out != cancelled) {
                    cancelled = out
                    targetStrength = if (out) 0f else 1f
                    if (out) selected = -1
                }
                if (!cancelled) {
                    focus = focusFor(e.y, n)
                    select(n, tick = true)
                }
                invalidate()
            }
            MotionEvent.ACTION_UP -> {
                removeCallbacks(longPressRunnable)
                val idx = selected
                val launch = touching && !cancelled && !longPressed && idx in 0 until n
                val bounds = if (launch) Rect(0, rowTop[idx].toInt(), width,
                    (rowTop[idx] + rowHeight[idx]).toInt()) else null
                release()
                if (launch) listener?.onItemClick(idx, bounds!!)
            }
            MotionEvent.ACTION_CANCEL -> {
                removeCallbacks(longPressRunnable)
                release()
            }
        }
        return true
    }

    private fun select(n: Int, tick: Boolean) {
        val idx = floor(focus).toInt().coerceIn(0, n - 1)
        if (idx != selected) {
            selected = idx
            highlighted = idx
            if (tick && haptics) {
                val fx = if (Build.VERSION.SDK_INT >= 34) HapticFeedbackConstants.SEGMENT_FREQUENT_TICK
                else HapticFeedbackConstants.CLOCK_TICK
                performHapticFeedback(fx)
            }
        }
    }

    private fun release() {
        touching = false
        targetStrength = 0f
        selected = -1
        invalidate()
    }

    private companion object {
        /** How much a row's slot grows relative to its text (slightly less keeps the list compact). */
        const val GROWTH = 0.8f
    }
}
