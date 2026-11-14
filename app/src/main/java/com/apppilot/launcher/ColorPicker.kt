package com.apppilot.launcher

import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.EditText
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView

/** Hue / saturation / brightness sliders, a hex box and quick swatches. */
object ColorPicker {

    private val SWATCHES = intArrayOf(
        0xFF000000.toInt(), 0xFF0E0E10.toInt(), 0xFF18181B.toInt(), 0xFF2B2C2E.toInt(),
        0xFF6B7280.toInt(), 0xFFD1D5DB.toInt(), 0xFFF5F2EB.toInt(), 0xFFFFFFFF.toInt(),
        0xFFEF4444.toInt(), 0xFFFF6B35.toInt(), 0xFFF59E0B.toInt(), 0xFFFFD60A.toInt(),
        0xFF84CC16.toInt(), 0xFF22C55E.toInt(), 0xFF14B8A6.toInt(), 0xFF38BDF8.toInt(),
        0xFF3B82F6.toInt(), 0xFF6366F1.toInt(), 0xFF8B5CF6.toInt(), 0xFFD946EF.toInt(),
        0xFFE11D48.toInt(), 0xFF0B1D2A.toInt(), 0xFF14201A.toInt(), 0xFF2A1430.toInt()
    )

    fun show(context: Context, title: String, initial: Int, onPick: (Int) -> Unit) {
        val hsv = FloatArray(3)
        Color.colorToHSV(initial, hsv)
        var updating = false

        val preview = View(context)
        val previewBg = GradientDrawable().apply { cornerRadius = context.dp(14f) }
        preview.background = previewBg

        val hex = EditText(context).apply {
            isSingleLine = true
            textSize = 16f
            hint = "#RRGGBB"
        }

        fun bar(maxV: Int) = SeekBar(context).apply {
            max = maxV
            setPadding(context.dpi(12), context.dpi(14), context.dpi(12), context.dpi(14))
        }
        val hue = bar(360)
        val sat = bar(100)
        val value = bar(100)
        hue.progressDrawable = gradient(IntArray(7) { Color.HSVToColor(floatArrayOf(it * 60f, 1f, 1f)) }, context)

        fun refresh(updateHex: Boolean) {
            updating = true
            val c = Color.HSVToColor(hsv)
            previewBg.setColor(c)
            hue.progress = hsv[0].toInt()
            sat.progress = (hsv[1] * 100).toInt()
            value.progress = (hsv[2] * 100).toInt()
            sat.progressDrawable = gradient(intArrayOf(
                Color.HSVToColor(floatArrayOf(hsv[0], 0f, hsv[2])),
                Color.HSVToColor(floatArrayOf(hsv[0], 1f, hsv[2]))), context)
            value.progressDrawable = gradient(intArrayOf(
                Color.BLACK, Color.HSVToColor(floatArrayOf(hsv[0], hsv[1], 1f))), context)
            if (updateHex) hex.setText(Colors.hex(c))
            updating = false
        }

        val listener = object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(s: SeekBar, p: Int, fromUser: Boolean) {
                if (updating || !fromUser) return
                when (s) {
                    hue -> hsv[0] = p.toFloat()
                    sat -> hsv[1] = p / 100f
                    value -> hsv[2] = p / 100f
                }
                refresh(true)
            }
            override fun onStartTrackingTouch(s: SeekBar) {}
            override fun onStopTrackingTouch(s: SeekBar) {}
        }
        hue.setOnSeekBarChangeListener(listener)
        sat.setOnSeekBarChangeListener(listener)
        value.setOnSeekBarChangeListener(listener)

        hex.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (updating) return
                var t = s?.toString()?.trim().orEmpty()
                if (!t.startsWith("#")) t = "#$t"
                if (t.length != 7) return
                val c = runCatching { Color.parseColor(t) }.getOrNull() ?: return
                Color.colorToHSV(c, hsv)
                refresh(false)
            }
        })

        val grid = GridLayout(context).apply { columnCount = 8 }
        val size = context.dpi(30)
        val margin = context.dpi(4)
        for (c in SWATCHES) {
            grid.addView(View(context).apply {
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(c)
                    setStroke(context.dpi(1), 0x55888888)
                }
                setOnClickListener { Color.colorToHSV(c, hsv); refresh(true) }
            }, GridLayout.LayoutParams().apply {
                width = size; height = size
                setMargins(margin, margin, margin, margin)
            })
        }

        fun label(t: String) = TextView(context).apply {
            text = t
            textSize = 12f
            alpha = 0.7f
            setPadding(context.dpi(4), context.dpi(8), 0, 0)
        }

        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(context.dpi(22), context.dpi(12), context.dpi(22), 0)
            addView(preview, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, context.dpi(52)))
            addView(hex)
            addView(label("Hue")); addView(hue)
            addView(label("Saturation")); addView(sat)
            addView(label("Brightness")); addView(value)
            addView(grid, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = context.dpi(8) })
        }
        refresh(true)

        AlertDialog.Builder(context, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle(title)
            .setView(android.widget.ScrollView(context).apply { addView(content) })
            .setPositiveButton("Apply") { _, _ -> onPick(Color.HSVToColor(hsv)) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun gradient(colors: IntArray, context: Context) =
        GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, colors).apply {
            cornerRadius = context.dp(6f)
            setSize(0, context.dpi(10))
        }
}
