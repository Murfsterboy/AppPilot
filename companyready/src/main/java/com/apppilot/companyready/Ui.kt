package com.apppilot.companyready

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.net.Uri
import android.os.Bundle
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.StyleSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

fun Context.dp(v: Float): Float =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)

fun Context.dpi(v: Int): Int = dp(v.toFloat()).toInt()

/** Colours for light and dark mode. Everything is drawn in code from these. */
class Palette(context: Context) {
    val dark = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
        Configuration.UI_MODE_NIGHT_YES
    val bg = if (dark) 0xFF0E131C.toInt() else 0xFFF5F7FB.toInt()
    val surface = if (dark) 0xFF182131.toInt() else Color.WHITE
    val surfaceAlt = if (dark) 0xFF202B3E.toInt() else 0xFFEEF2F8.toInt()
    val text = if (dark) 0xFFE8ECF3.toInt() else 0xFF14213D.toInt()
    val subtext = if (dark) 0xFFA3AEC2.toInt() else 0xFF5B6478.toInt()
    val primary = 0xFF1D3557.toInt()
    val header = if (dark) 0xFF0E131C.toInt() else primary
    val accent = if (dark) 0xFF4CC9B0.toInt() else 0xFF2A9D8F.toInt()
    val onAccent = if (dark) 0xFF06201B.toInt() else Color.WHITE
    val link = if (dark) 0xFF7FB3FF.toInt() else 0xFF1D5FBF.toInt()
    val warn = if (dark) 0xFFFFB454.toInt() else 0xFFB35C00.toInt()
    val warnBg = if (dark) 0xFF3A2A12.toInt() else 0xFFFFF4E0.toInt()
    val tipBg = if (dark) 0xFF123029.toInt() else 0xFFE6F6F3.toInt()
    val danger = if (dark) 0xFFFF7A7A.toInt() else 0xFFC62828.toInt()
    val divider = if (dark) 0xFF2A364B.toInt() else 0xFFDDE3EC.toInt()
    val good = if (dark) 0xFF6EDC8C.toInt() else 0xFF2E7D32.toInt()
}

fun rounded(color: Int, radius: Float, stroke: Int = 0, strokeColor: Int = 0) = GradientDrawable().apply {
    setColor(color)
    cornerRadius = radius
    if (stroke > 0) setStroke(stroke, strokeColor)
}

/**
 * Base screen: a coloured top bar with a back arrow and title, and a scrolling column of
 * content. Handles edge-to-edge insets (enforced from Android 15/16) by padding itself.
 */
abstract class BaseActivity : Activity() {
    lateinit var pal: Palette
    lateinit var root: LinearLayout
    lateinit var scroll: ScrollView
    lateinit var content: LinearLayout
    lateinit var titleView: TextView
    lateinit var subtitleView: TextView
    lateinit var bar: LinearLayout
    private var footer: LinearLayout? = null

    open val showBack = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pal = Palette(this)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(pal.bg)
        }
        bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(pal.header)
            setPadding(dpi(4), dpi(6), dpi(16), dpi(12))
        }
        if (showBack) {
            val back = TextView(this).apply {
                text = "←"
                textSize = 24f
                setTextColor(Color.WHITE)
                gravity = Gravity.CENTER
                contentDescription = "Back"
                minWidth = dpi(48); minHeight = dpi(48)
                background = RippleDrawable(ColorStateList.valueOf(0x33FFFFFF), null, null)
                setOnClickListener { finish() }
            }
            bar.addView(back)
        } else {
            bar.setPadding(dpi(20), dpi(10), dpi(16), dpi(14))
        }
        val titles = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        titleView = TextView(this).apply {
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.WHITE)
        }
        subtitleView = TextView(this).apply {
            textSize = 13f
            setTextColor(0xCCFFFFFF.toInt())
            visibility = View.GONE
        }
        titles.addView(titleView)
        titles.addView(subtitleView)
        bar.addView(titles, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(bar)

        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpi(16), dpi(12), dpi(16), dpi(32))
        }
        scroll = ScrollView(this).apply {
            isFillViewport = true
            addView(content)
        }
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)

        root.setOnApplyWindowInsetsListener { v, insets ->
            @Suppress("DEPRECATION")
            val top = insets.systemWindowInsetTop
            @Suppress("DEPRECATION")
            val bottom = insets.systemWindowInsetBottom
            @Suppress("DEPRECATION")
            val left = insets.systemWindowInsetLeft
            @Suppress("DEPRECATION")
            val right = insets.systemWindowInsetRight
            bar.setPadding(bar.paddingLeft, (if (showBack) dpi(6) else dpi(10)) + top, bar.paddingRight, bar.paddingBottom)
            v.setPadding(left, 0, right, bottom)
            insets
        }
    }

    fun setTitles(title: String, subtitle: String? = null) {
        titleView.text = title
        this.title = title
        if (subtitle.isNullOrEmpty()) subtitleView.visibility = View.GONE
        else { subtitleView.text = subtitle; subtitleView.visibility = View.VISIBLE }
    }

    /** A bar fixed under the scrolling content, for primary actions. */
    fun footerBar(): LinearLayout {
        footer?.let { return it }
        val f = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dpi(16), dpi(10), dpi(16), dpi(12))
            setBackgroundColor(pal.surface)
            elevation = dp(8f)
        }
        root.addView(f)
        footer = f
        return f
    }

    // ---------- builders ----------

    fun lp(w: Int = -1, h: Int = -2, top: Int = 0, bottom: Int = 0) =
        LinearLayout.LayoutParams(w, h).apply { topMargin = dpi(top); bottomMargin = dpi(bottom) }

    fun card(parent: ViewGroup = content, padding: Int = 16, onClick: (() -> Unit)? = null): LinearLayout {
        val c = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpi(padding), dpi(padding), dpi(padding), dpi(padding))
            val bgd = rounded(pal.surface, dp(16f), if (pal.dark) 0 else dpi(1), pal.divider)
            background = if (onClick != null)
                RippleDrawable(ColorStateList.valueOf(Palette(context).accent and 0x33FFFFFF), bgd, null)
            else bgd
            if (onClick != null) {
                isClickable = true; isFocusable = true
                setOnClickListener { onClick() }
            }
        }
        parent.addView(c, lp(bottom = 12))
        return c
    }

    fun sectionHeader(text: String, parent: ViewGroup = content) = TextView(this).apply {
        this.text = text.uppercase()
        textSize = 13f
        letterSpacing = 0.08f
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(pal.accent)
        setPadding(dpi(4), dpi(14), 0, dpi(8))
        isFocusable = true
        accessibilityHeading()
        parent.addView(this)
    }

    fun View.accessibilityHeading() {
        if (android.os.Build.VERSION.SDK_INT >= 28) isAccessibilityHeading = true
    }

    fun heading(text: String, parent: ViewGroup = content, size: Float = 18f) = TextView(this).apply {
        this.text = text
        textSize = size
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(pal.text)
        accessibilityHeading()
        parent.addView(this, lp(bottom = 4))
    }

    fun body(text: CharSequence, parent: ViewGroup = content, color: Int = pal.text, size: Float = 15.5f) =
        TextView(this).apply {
            this.text = if (text is String) Markup.format(text) else text
            textSize = size
            setTextColor(color)
            setLineSpacing(dp(3f), 1f)
            parent.addView(this, lp(bottom = 6))
        }

    fun small(text: CharSequence, parent: ViewGroup = content) = body(text, parent, pal.subtext, 13.5f)

    fun callout(text: String, warning: Boolean, parent: ViewGroup = content) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dpi(12), dpi(10), dpi(12), dpi(10))
            background = rounded(if (warning) pal.warnBg else pal.tipBg, dp(12f))
        }
        val icon = TextView(this).apply {
            this.text = if (warning) "⚠" else "💡"
            textSize = 16f
            setPadding(0, 0, dpi(10), 0)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        val t = TextView(this).apply {
            this.text = Markup.format((if (warning) "**Watch out:** " else "**Tip:** ") + text)
            textSize = 14.5f
            setTextColor(pal.text)
            setLineSpacing(dp(2f), 1f)
        }
        box.addView(icon)
        box.addView(t, LinearLayout.LayoutParams(0, -2, 1f))
        parent.addView(box, lp(top = 4, bottom = 8))
    }

    fun primaryButton(text: String, parent: ViewGroup = content, weight: Boolean = false, onClick: () -> Unit): Button =
        Button(this).apply {
            this.text = text
            isAllCaps = false
            textSize = 15.5f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(pal.onAccent)
            background = RippleDrawable(ColorStateList.valueOf(0x33FFFFFF), rounded(pal.accent, dp(24f)), null)
            stateListAnimator = null
            minHeight = dpi(48)
            setPadding(dpi(18), 0, dpi(18), 0)
            setOnClickListener { onClick() }
            parent.addView(this, if (weight) LinearLayout.LayoutParams(0, -2, 1f).apply { marginStart = dpi(4); marginEnd = dpi(4) } else lp(top = 6, bottom = 6))
        }

    fun secondaryButton(text: String, parent: ViewGroup = content, weight: Boolean = false, onClick: () -> Unit): Button =
        Button(this).apply {
            this.text = text
            isAllCaps = false
            textSize = 15f
            setTextColor(pal.accent)
            background = RippleDrawable(ColorStateList.valueOf(pal.accent and 0x33FFFFFF),
                rounded(Color.TRANSPARENT, dp(24f), dpi(1), pal.accent), null)
            stateListAnimator = null
            minHeight = dpi(48)
            setPadding(dpi(16), 0, dpi(16), 0)
            setOnClickListener { onClick() }
            parent.addView(this, if (weight) LinearLayout.LayoutParams(0, -2, 1f).apply { marginStart = dpi(4); marginEnd = dpi(4) } else lp(top = 4, bottom = 4))
        }

    fun progressBar(parent: ViewGroup, fraction: Float, color: Int = pal.accent, track: Int = pal.surfaceAlt): ProgressBar =
        ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 1000
            progress = (fraction.coerceIn(0f, 1f) * 1000).toInt()
            progressTintList = ColorStateList.valueOf(color)
            progressBackgroundTintList = ColorStateList.valueOf(track)
            parent.addView(this, LinearLayout.LayoutParams(-1, dpi(8)).apply { topMargin = dpi(6); bottomMargin = dpi(4) })
        }

    fun divider(parent: ViewGroup = content) = View(this).apply {
        setBackgroundColor(pal.divider)
        parent.addView(this, LinearLayout.LayoutParams(-1, dpi(1)).apply { topMargin = dpi(8); bottomMargin = dpi(8) })
    }

    /** A row with a label on the left and a value on the right. */
    fun valueRow(label: String, value: String, parent: ViewGroup, bold: Boolean = false, valueColor: Int = pal.text): LinearLayout {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dpi(3), 0, dpi(3))
        }
        row.addView(TextView(this).apply {
            text = label; textSize = 14.5f; setTextColor(pal.subtext)
            if (bold) { setTypeface(typeface, Typeface.BOLD); setTextColor(pal.text) }
        }, LinearLayout.LayoutParams(0, -2, 1f))
        row.addView(TextView(this).apply {
            text = value; textSize = 14.5f; setTextColor(valueColor); gravity = Gravity.END
            if (bold) setTypeface(typeface, Typeface.BOLD)
        })
        parent.addView(row)
        return row
    }

    fun linkRow(link: Link, parent: ViewGroup) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpi(4), dpi(10), dpi(4), dpi(10))
            minimumHeight = dpi(48)
            background = RippleDrawable(ColorStateList.valueOf(pal.accent and 0x33FFFFFF), null,
                rounded(Color.WHITE, dp(8f)))
            isClickable = true; isFocusable = true
            contentDescription = "${link.title}. ${link.note}. Opens ${hostOf(link.url)} in your browser"
            setOnClickListener { openUrl(link.url) }
        }
        val texts = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        texts.addView(TextView(this).apply {
            text = link.title; textSize = 15f; setTextColor(pal.link); setTypeface(typeface, Typeface.BOLD)
        })
        val sub = if (link.note.isNotEmpty()) "${link.note} · ${hostOf(link.url)}" else hostOf(link.url)
        texts.addView(TextView(this).apply { text = sub; textSize = 12.5f; setTextColor(pal.subtext) })
        row.addView(texts, LinearLayout.LayoutParams(0, -2, 1f))
        row.addView(TextView(this).apply { text = "↗"; textSize = 18f; setTextColor(pal.link); setPadding(dpi(8), 0, 0, 0) })
        parent.addView(row)
    }

    fun input(hint: String, parent: ViewGroup, value: String = "", type: Int = android.text.InputType.TYPE_CLASS_TEXT): EditText =
        EditText(this).apply {
            this.hint = hint
            setText(value)
            inputType = type
            textSize = 16f
            setTextColor(pal.text)
            setHintTextColor(pal.subtext)
            background = rounded(pal.surfaceAlt, dp(10f))
            setPadding(dpi(12), dpi(12), dpi(12), dpi(12))
            minHeight = dpi(48)
            parent.addView(this, lp(top = 2, bottom = 10))
        }

    fun label(text: String, parent: ViewGroup) = TextView(this).apply {
        this.text = text
        textSize = 13.5f
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(pal.subtext)
        parent.addView(this, lp(top = 4))
    }

    /** A row of selectable pill chips; returns a function to read the selection. */
    fun chips(options: List<String>, selected: Int, parent: ViewGroup, onSelect: (Int) -> Unit): LinearLayout {
        val wrap = FlowLayout(this)
        var current = selected
        val views = mutableListOf<TextView>()
        fun style() {
            views.forEachIndexed { i, v ->
                val on = i == current
                v.setTextColor(if (on) pal.onAccent else pal.text)
                v.background = rounded(if (on) pal.accent else pal.surfaceAlt, dp(18f))
                v.isSelected = on
            }
        }
        options.forEachIndexed { i, o ->
            val v = TextView(this).apply {
                text = o
                textSize = 14f
                setPadding(dpi(14), dpi(9), dpi(14), dpi(9))
                minHeight = dpi(40)
                gravity = Gravity.CENTER
                isClickable = true; isFocusable = true
                setOnClickListener { current = i; style(); onSelect(i) }
            }
            views += v
            wrap.addView(v)
        }
        style()
        val holder = LinearLayout(this)
        holder.addView(wrap, LinearLayout.LayoutParams(-1, -2))
        parent.addView(holder, lp(top = 2, bottom = 8))
        return holder
    }

    fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}

fun hostOf(url: String): String = try { Uri.parse(url).host?.removePrefix("www.") ?: url } catch (e: Exception) { url }

fun Activity.openUrl(url: String) {
    try {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
    } catch (e: ActivityNotFoundException) {
        Toast.makeText(this, "No browser found to open $url", Toast.LENGTH_LONG).show()
    }
}

fun Activity.safeStart(intent: Intent, failMsg: String = "No app found to do that") {
    try { startActivity(intent) } catch (e: ActivityNotFoundException) {
        Toast.makeText(this, failMsg, Toast.LENGTH_LONG).show()
    }
}

/** Lays children left to right, wrapping onto new lines (for chips). */
class FlowLayout(context: Context) : ViewGroup(context) {
    private val gap = context.dpi(8)

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val maxW = MeasureSpec.getSize(widthMeasureSpec) - paddingLeft - paddingRight
        var x = 0; var y = 0; var lineH = 0
        for (i in 0 until childCount) {
            val c = getChildAt(i)
            c.measure(MeasureSpec.makeMeasureSpec(maxW, MeasureSpec.AT_MOST), MeasureSpec.UNSPECIFIED)
            if (x > 0 && x + c.measuredWidth > maxW) { x = 0; y += lineH + gap; lineH = 0 }
            x += c.measuredWidth + gap
            lineH = maxOf(lineH, c.measuredHeight)
        }
        setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), y + lineH + paddingTop + paddingBottom)
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val maxW = r - l - paddingLeft - paddingRight
        var x = 0; var y = 0; var lineH = 0
        for (i in 0 until childCount) {
            val c = getChildAt(i)
            if (x > 0 && x + c.measuredWidth > maxW) { x = 0; y += lineH + gap; lineH = 0 }
            c.layout(paddingLeft + x, paddingTop + y, paddingLeft + x + c.measuredWidth, paddingTop + y + c.measuredHeight)
            x += c.measuredWidth + gap
            lineH = maxOf(lineH, c.measuredHeight)
        }
    }
}

/**
 * Tiny markup for lesson text: **bold**, and lines starting with "• " shown as bullets
 * with a hanging indent.
 */
object Markup {
    fun format(src: String): CharSequence {
        val out = SpannableStringBuilder()
        val lines = src.trimIndent().split("\n")
        lines.forEachIndexed { i, raw ->
            val line = raw.trimEnd()
            val start = out.length
            if (line.startsWith("• ") || line.startsWith("- ")) {
                appendBold(out, "•  " + line.substring(2))
                out.setSpan(android.text.style.LeadingMarginSpan.Standard(0, 36), start, out.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            } else {
                appendBold(out, line)
            }
            if (i < lines.size - 1) out.append("\n")
        }
        return out
    }

    private fun appendBold(out: SpannableStringBuilder, text: String) {
        val parts = text.split("**")
        parts.forEachIndexed { i, p ->
            val s = out.length
            out.append(p)
            if (i % 2 == 1) out.setSpan(StyleSpan(Typeface.BOLD), s, out.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
    }
}
