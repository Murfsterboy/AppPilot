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
import android.widget.TextView

/** A compact list of recent notifications for the home screen (either side). */
class NotificationFeedView(context: Context) : LinearLayout(context) {

    interface Listener {
        fun onOpen(e: NotificationEntry)
        fun onMenu(e: NotificationEntry)
        fun onClearAll()
    }

    var listener: Listener? = null

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
    private val more = TextView(context).apply {
        textSize = 12f
        alpha = 0.6f
        setPadding(dpi(4), dpi(4), dpi(4), 0)
    }

    init {
        orientation = VERTICAL
        header.addView(title, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
        header.addView(clear)
    }

    fun bind(entries: List<NotificationEntry>, maxItems: Int, textColor: Int, accent: Int) {
        removeAllViews()
        visibility = if (entries.isEmpty()) View.GONE else View.VISIBLE
        if (entries.isEmpty()) return
        title.setTextColor(accent)
        clear.setTextColor(textColor)
        clear.visibility = if (entries.any { it.clearable }) View.VISIBLE else View.GONE
        addView(header)
        val now = System.currentTimeMillis()
        for (e in entries.take(maxItems)) addView(card(e, now, textColor), LayoutParams(
            LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply { topMargin = dpi(6) })
        val extra = entries.size - maxItems
        if (extra > 0) {
            more.text = "+$extra more"
            more.setTextColor(textColor)
            addView(more)
        }
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
            textSize = 11f
            setTextColor(Colors.withAlpha(textColor, 0.6f))
            isSingleLine = true
            ellipsize = TextUtils.TruncateAt.END
        }
        val head = TextView(context).apply {
            text = e.title.ifBlank { e.text }
            textSize = 14f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setTextColor(textColor)
            isSingleLine = true
            ellipsize = TextUtils.TruncateAt.END
        }
        val body = TextView(context).apply {
            text = e.text
            textSize = 13f
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
            setPadding(dpi(12), dpi(10), dpi(12), dpi(10))
            background = GradientDrawable().apply {
                cornerRadius = dp(14f)
                setColor(Colors.withAlpha(textColor, 0.08f))
            }
            addView(icon, LayoutParams(dpi(18), dpi(18)).apply { topMargin = dpi(2); marginEnd = dpi(10) })
            addView(texts, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
            contentDescription = "${e.appLabel}: ${e.summary}"
            setOnClickListener { listener?.onOpen(e) }
            setOnLongClickListener { listener?.onMenu(e); true }
        }
    }
}
