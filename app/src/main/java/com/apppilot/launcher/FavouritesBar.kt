package com.apppilot.launcher

import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * A desktop-style row of app icons along the bottom of the clock side (on by default on tablets):
 * your pinned apps and shortcuts first, then your most-used apps.
 */
class FavouritesBar(context: Context) : HorizontalScrollView(context) {

    interface Listener {
        fun onOpen(app: AppEntry, tile: View)
        fun onMenu(app: AppEntry)
    }

    var listener: Listener? = null

    private val row = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
    }

    init {
        isHorizontalScrollBarEnabled = false
        overScrollMode = OVER_SCROLL_IF_CONTENT_SCROLLS
        isFillViewport = false
        addView(row)
        contentDescription = "Favourites bar"
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
    }

    private var lastKey = ""

    /** Shows [apps] as icon tiles. [scale] grows everything on large screens. */
    fun bind(apps: List<AppEntry>, textColor: Int, scale: Float) {
        val key = apps.joinToString("|") { it.key } + "/$textColor/$scale"
        if (key == lastKey) return
        lastKey = key
        row.removeAllViews()
        val tileW = (dp(76f) * scale).toInt()
        val iconSize = (dp(44f) * scale).toInt()
        background = GradientDrawable().apply {
            cornerRadius = dp(22f) * scale
            setColor(Colors.withAlpha(textColor, 0.07f))
        }
        val pad = (dp(10f) * scale).toInt()
        setPadding(pad, pad, pad, pad)
        for (app in apps) {
            val icon = ImageView(context).apply {
                if (app.icon != null) setImageBitmap(app.icon)
                importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            val label = TextView(context).apply {
                text = app.label
                textSize = 11f * scale
                setTextColor(Colors.withAlpha(textColor, 0.85f))
                gravity = Gravity.CENTER_HORIZONTAL
                isSingleLine = true
                ellipsize = TextUtils.TruncateAt.END
                importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            val tile = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(0, (dp(4f) * scale).toInt(), 0, (dp(2f) * scale).toInt())
                addView(icon, LinearLayout.LayoutParams(iconSize, iconSize))
                addView(label, LinearLayout.LayoutParams(tileW, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = (dp(6f) * scale).toInt()
                })
                contentDescription = app.label
                isClickable = true
                isFocusable = true
                background = context.obtainStyledAttributes(intArrayOf(android.R.attr.selectableItemBackgroundBorderless))
                    .let { a -> a.getDrawable(0).also { a.recycle() } }
                setOnClickListener { v -> listener?.onOpen(app, v) }
                setOnLongClickListener { listener?.onMenu(app); true }
            }
            row.addView(tile, LinearLayout.LayoutParams(tileW, LinearLayout.LayoutParams.WRAP_CONTENT))
        }
        visibility = if (apps.isEmpty()) View.GONE else View.VISIBLE
    }
}
