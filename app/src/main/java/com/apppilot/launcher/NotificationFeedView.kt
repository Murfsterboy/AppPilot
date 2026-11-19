package com.apppilot.launcher

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.text.format.DateUtils
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** A compact list of recent notifications for the home screen (either side). */
class NotificationFeedView(context: Context) : LinearLayout(context) {

    interface Listener {
        fun onOpen(e: NotificationEntry)
        fun onMenu(e: NotificationEntry)
        fun onClearAll()
    }

    var listener: Listener? = null

    /** Grows text and icons on tablets. */
    var scale = 1f

    private val header = LinearLayout(context).apply {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
    }
    private val title = TextView(context).apply {
        text = "Notifications"
        textSize = 12f
        isAllCaps = true
        letterSpacing = 0.08f
        typeface = Typeface.DEFAULT_BOLD
    }
    private val clear = TextView(context).apply {
        text = "Clear all"
        textSize = 12f
        setPadding(dpi(12), dpi(8), dpi(4), dpi(8))
        setOnClickListener { listener?.onClearAll() }
    }
    /** "+N more" / "Show less": expands the feed to every notification. */
    private val more = TextView(context).apply {
        textSize = 13f
        setPadding(dpi(4), dpi(10), dpi(16), dpi(10))
        setOnClickListener {
            expanded = !expanded
            last?.let { (e, m, t, a) -> bind(e, m, t, a) }
            if (!expanded) scroll.scrollTo(0, 0)
        }
    }

    /** The cards scroll within [maxListHeight] so a long feed never runs into the rest of the screen. */
    private val list = LinearLayout(context).apply { orientation = VERTICAL }
    private val scroll = MaxHeightScrollView(context).apply {
        isVerticalScrollBarEnabled = true
        isVerticalFadingEdgeEnabled = true
        setFadingEdgeLength(dpi(24))
        overScrollMode = OVER_SCROLL_IF_CONTENT_SCROLLS
        addView(list, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
    }

    private var expanded = false
    private var last: Bound? = null
    private data class Bound(val entries: List<NotificationEntry>, val maxItems: Int, val textColor: Int, val accent: Int)

    /** Height available to the cards (set by the home screen from the space it has). */
    var maxListHeight: Int
        get() = scroll.maxHeight
        set(v) {
            if (v != scroll.maxHeight) { scroll.maxHeight = v; scroll.requestLayout() }
        }

    /** Height of the "+N more" line under the cards (0 when not shown). */
    val footerHeight: Int get() = if (more.parent != null) more.height.coerceAtLeast(dpi(40)) else 0

    /** Top of the cards relative to [ancestor]. */
    fun listTopIn(ancestor: View): Int {
        val a = IntArray(2); val b = IntArray(2)
        scroll.getLocationInWindow(a); ancestor.getLocationInWindow(b)
        return a[1] - b[1]
    }

    /** Back to the short list (e.g. when leaving the home screen). */
    fun collapse() {
        if (!expanded) return
        expanded = false
        scroll.scrollTo(0, 0)
        last?.let { (e, m, t, a) -> bind(e, m, t, a) }
    }

    init {
        orientation = VERTICAL
        header.addView(title, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
        header.addView(clear)
    }

    fun bind(entries: List<NotificationEntry>, maxItems: Int, textColor: Int, accent: Int) {
        last = Bound(entries, maxItems, textColor, accent)
        removeAllViews()
        list.removeAllViews()
        visibility = if (entries.isEmpty()) View.GONE else View.VISIBLE
        if (entries.isEmpty()) { expanded = false; return }
        title.setTextColor(accent)
        title.textSize = 12f * scale
        clear.textSize = 12f * scale
        more.textSize = 13f * scale
        clear.setTextColor(textColor)
        clear.visibility = if (entries.any { it.clearable }) View.VISIBLE else View.GONE
        addView(header)
        val now = System.currentTimeMillis()
        val shown = if (expanded) entries else entries.take(maxItems)
        for (e in shown) list.addView(card(e, now, textColor), LayoutParams(
            LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply { topMargin = dpi(6) })
        addView(scroll, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        val extra = entries.size - maxItems
        if (extra > 0) {
            more.text = if (expanded) "Show less" else "+$extra more  ›"
            more.setTextColor(accent)
            more.contentDescription = if (expanded) "Show fewer notifications" else "Show $extra more notifications"
            addView(more)
        } else expanded = false
    }

    private fun card(e: NotificationEntry, now: Long, textColor: Int): View {
        val icon = ImageView(context).apply {
            e.smallIcon?.loadDrawable(context)?.let { d ->
                d.mutate().setTint(textColor)
                setImageDrawable(d)
            }
            alpha = 0.8f
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        val meta = TextView(context).apply {
            val ago = DateUtils.getRelativeTimeSpanString(e.time, now, DateUtils.MINUTE_IN_MILLIS,
                DateUtils.FORMAT_ABBREV_RELATIVE)
            text = "${e.appLabel} · $ago"
            textSize = 11f * scale
            setTextColor(Colors.withAlpha(textColor, 0.6f))
            isSingleLine = true
            ellipsize = TextUtils.TruncateAt.END
        }
        val head = TextView(context).apply {
            text = e.title.ifBlank { e.text }
            textSize = 14f * scale
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setTextColor(textColor)
            isSingleLine = true
            ellipsize = TextUtils.TruncateAt.END
        }
        val body = TextView(context).apply {
            text = e.text
            textSize = 13f * scale
            setTextColor(Colors.withAlpha(textColor, 0.8f))
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
            visibility = if (e.title.isBlank() || e.text.isBlank()) View.GONE else View.VISIBLE
        }
        val texts = LinearLayout(context).apply {
            orientation = VERTICAL
            addView(meta); addView(head); addView(body)
        }
        return LinearLayout(context).apply {
            orientation = HORIZONTAL
            setPadding((dp(12f) * scale).toInt(), (dp(10f) * scale).toInt(), (dp(12f) * scale).toInt(), (dp(10f) * scale).toInt())
            background = GradientDrawable().apply {
                cornerRadius = dp(14f) * scale
                setColor(Colors.withAlpha(textColor, 0.08f))
            }
            val iconPx = (dp(18f) * scale).toInt()
            addView(icon, LayoutParams(iconPx, iconPx).apply { topMargin = dpi(2); marginEnd = (dp(10f) * scale).toInt() })
            addView(texts, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
            contentDescription = "${e.appLabel}: ${e.summary}"
            setOnClickListener { listener?.onOpen(e) }
            setOnLongClickListener { listener?.onMenu(e); true }
        }
    }
}

/** A ScrollView that wraps its content up to [maxHeight], then scrolls. */
class MaxHeightScrollView(context: Context) : ScrollView(context) {
    var maxHeight = Int.MAX_VALUE

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        var spec = heightMeasureSpec
        if (maxHeight < Int.MAX_VALUE) {
            val mode = MeasureSpec.getMode(heightMeasureSpec)
            val size = MeasureSpec.getSize(heightMeasureSpec)
            val limit = if (mode == MeasureSpec.UNSPECIFIED) maxHeight else minOf(size, maxHeight)
            spec = MeasureSpec.makeMeasureSpec(limit, MeasureSpec.AT_MOST)
        }
        super.onMeasure(widthMeasureSpec, spec)
    }
}
