package com.apppilot.launcher

import android.app.Activity
import android.app.AlertDialog
import android.app.role.RoleManager
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import kotlin.math.roundToInt

class SettingsActivity : Activity() {

    private lateinit var prefs: Prefs
    private lateinit var repo: AppRepository
    private lateinit var scroll: ScrollView
    private lateinit var container: LinearLayout
    private var preview: MagnifyListView? = null
    private var previewFrame: FrameLayout? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        repo = AppRepository(this, prefs)
        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 0, 0, dpi(40))
        }
        scroll = ScrollView(this).apply {
            fitsSystemWindows = true
            addView(container)
        }
        setContentView(scroll)
    }

    override fun onResume() {
        super.onResume()
        rebuild()
    }

    override fun onDestroy() {
        repo.shutdown()
        super.onDestroy()
    }

    private fun rebuild() {
        val y = scroll.scrollY
        container.removeAllViews()

        header("Setup")
        action("Home screen", if (isDefaultHome()) "AppPilot is your home screen ✓" else "Tap to make AppPilot your home screen") {
            requestHome()
        }
        action("Usage access", if (repo.hasUsageAccess()) "Granted ✓ — ranking uses real app usage"
        else "Not granted — ranking uses apps opened from AppPilot only. Tap to allow.") {
            AppActions.safeStart(this, Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }

        header("Colour scheme")
        presets()
        color("Left side background", prefs.leftBg) { prefs.leftBg = it }
        color("Left side text (clock & date)", prefs.leftText) { prefs.leftText = it }
        color("Right side background", prefs.rightBg) { prefs.rightBg = it }
        color("App list text", prefs.listText) { prefs.listText = it }
        color("Highlight colour", prefs.highlight) { prefs.highlight = it }
        switch("Show wallpaper behind", "Use your wallpaper with the colours on top", prefs.showWallpaper) {
            prefs.showWallpaper = it; rebuild()
        }
        if (prefs.showWallpaper) {
            slider("Left side opacity", 0f, 100f, 5f, prefs.leftOpacity.toFloat(), { "${it.toInt()}%" }) {
                prefs.leftOpacity = it.toInt()
            }
            slider("Right side opacity", 0f, 100f, 5f, prefs.rightOpacity.toFloat(), { "${it.toInt()}%" }) {
                prefs.rightOpacity = it.toInt()
            }
        }

        header("App list")
        note("Try it: drag your finger down the preview.")
        previewBox()
        slider("Number of apps", 5f, 30f, 1f, prefs.appCount.toFloat(), { it.toInt().toString() }) {
            prefs.appCount = it.toInt(); applyPreview()
        }
        slider("Text size", 12f, 26f, 1f, prefs.textSizeSp, { "${it.toInt()} sp" }) {
            prefs.textSizeSp = it; applyPreview()
        }
        slider("Magnification", 1f, 3.5f, 0.1f, prefs.magnification, { String.format("%.1f×", it) }) {
            prefs.magnification = it; applyPreview()
        }
        slider("Magnify spread", 0.6f, 3f, 0.1f, prefs.spread, { String.format("%.1f rows", it) }) {
            prefs.spread = it; applyPreview()
        }
        slider("List width", 30f, 75f, 1f, prefs.panelPercent.toFloat(), { "${it.toInt()}% of screen" }) {
            prefs.panelPercent = it.toInt(); applyPreview()
        }
        slider("List position", 0f, 1f, 0.05f, prefs.verticalBias, {
            when {
                it < 0.3f -> "Top"; it > 0.7f -> "Bottom (thumb friendly)"; else -> "Centre"
            }
        }) { prefs.verticalBias = it; applyPreview() }
        switch("Show app icons", null, prefs.showIcons) { prefs.showIcons = it; applyPreview() }
        switch("Highlight pill", "Soft bubble behind the app under your finger", prefs.highlightPill) {
            prefs.highlightPill = it; applyPreview()
        }
        switch("Haptic ticks", "Feel a tick as you pass each app", prefs.haptics) {
            prefs.haptics = it; applyPreview()
        }
        switch("Left-handed mode", "Put the list on the left edge", prefs.listOnLeft) {
            prefs.listOnLeft = it; applyPreview()
        }

        header("Ranking")
        choice("Rank apps by", listOf("Times opened", "Screen time"), prefs.rankBy) { prefs.rankBy = it }
        val days = listOf(1, 3, 7, 14, 30)
        choice("Look back over", days.map { if (it == 1) "Last 24 hours" else "Last $it days" },
            days.indexOf(prefs.rankDays).coerceAtLeast(0)) { prefs.rankDays = days[it] }
        note("Long-press any app (in the list or the all-apps screen) to pin it to the top, reorder pins, or hide it.")
        action("Reset AppPilot's launch history", "Only affects ranking without usage access") {
            AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                .setMessage("Clear launch history?")
                .setPositiveButton("Clear") { _, _ ->
                    prefs.clearHistory()
                    Toast.makeText(this, "Cleared", Toast.LENGTH_SHORT).show()
                }
                .setNegativeButton("Cancel", null).show()
        }
        action("Unhide all apps", "${prefs.hidden.size} hidden") { prefs.hidden = emptySet(); rebuild() }

        header("Home screen")
        switch("Show clock", "Tap the clock to open alarms", prefs.showClock) { prefs.showClock = it }
        switch("Show date", "Tap the date to open your calendar", prefs.showDate) { prefs.showDate = it }
        switch("Show gesture hints", null, prefs.showHint) { prefs.showHint = it }
        switch("Open keyboard in all-apps", "Start typing to search straight away", prefs.autoKeyboard) {
            prefs.autoKeyboard = it
        }
        note("Gestures on the left side: swipe up for all apps, swipe down for notifications, hold for settings.")

        scroll.post { scroll.scrollTo(0, y) }
    }

    // ------------------------------------------------------------------ row builders

    private fun header(title: String) {
        container.addView(TextView(this).apply {
            text = title
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(prefs.highlight.takeIf { Color.luminance(it) > 0.15f } ?: 0xFF38BDF8.toInt())
            setPadding(dpi(20), dpi(26), dpi(20), dpi(6))
        })
    }

    private fun note(text: String) {
        container.addView(TextView(this).apply {
            this.text = text
            textSize = 13f
            alpha = 0.65f
            setPadding(dpi(20), dpi(4), dpi(20), dpi(8))
        })
    }

    private fun row(title: String, subtitle: String?, trailing: View?, onClick: (() -> Unit)?): LinearLayout {
        val texts = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(context).apply { text = title; textSize = 16f })
            if (subtitle != null) addView(TextView(context).apply { text = subtitle; textSize = 13f; alpha = 0.65f })
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpi(20), dpi(12), dpi(20), dpi(12))
            minimumHeight = dpi(56)
            addView(texts, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            if (trailing != null) addView(trailing)
            if (onClick != null) {
                isClickable = true
                val ta = context.obtainStyledAttributes(intArrayOf(android.R.attr.selectableItemBackground))
                background = ta.getDrawable(0)
                ta.recycle()
                setOnClickListener { onClick() }
            }
        }
        container.addView(row)
        return row
    }

    private fun action(title: String, subtitle: String?, onClick: () -> Unit) {
        row(title, subtitle, null, onClick)
    }

    private fun color(title: String, value: Int, set: (Int) -> Unit) {
        val chip = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(value)
                setStroke(dpi(2), 0x66888888)
            }
            layoutParams = LinearLayout.LayoutParams(dpi(32), dpi(32))
        }
        row(title, Colors.hex(value), chip) {
            ColorPicker.show(this, title, value) { set(it); rebuild() }
        }
    }

    private fun switch(title: String, subtitle: String?, checked: Boolean, onChange: (Boolean) -> Unit) {
        val sw = Switch(this).apply {
            isChecked = checked
            setOnCheckedChangeListener { _, v -> onChange(v) }
        }
        row(title, subtitle, sw) { sw.toggle() }
    }

    private fun slider(
        title: String, min: Float, max: Float, step: Float, value: Float,
        format: (Float) -> String, onChange: (Float) -> Unit
    ) {
        val steps = ((max - min) / step).roundToInt()
        val label = TextView(this).apply {
            textSize = 16f
            text = "$title  ·  ${format(value)}"
        }
        val bar = SeekBar(this).apply {
            this.max = steps
            progress = ((value - min) / step).roundToInt()
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(s: SeekBar, p: Int, fromUser: Boolean) {
                    val v = min + p * step
                    label.text = "$title  ·  ${format(v)}"
                    if (fromUser) onChange(v)
                }
                override fun onStartTrackingTouch(s: SeekBar) {}
                override fun onStopTrackingTouch(s: SeekBar) {}
            })
        }
        container.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpi(20), dpi(10), dpi(20), dpi(4))
            addView(label)
            addView(bar)
        })
    }

    private fun choice(title: String, options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
        row(title, options.getOrNull(selected), null) {
            AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                .setTitle(title)
                .setSingleChoiceItems(options.toTypedArray(), selected) { d, which ->
                    onSelect(which); d.dismiss(); rebuild()
                }
                .show()
        }
    }

    private fun presets() {
        val strip = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dpi(14), dpi(4), dpi(14), dpi(10))
        }
        for (p in Prefs.PRESETS) {
            val tile = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                clipToOutline = true
                background = GradientDrawable().apply { cornerRadius = dp(12f); setColor(p.leftBg) }
                addView(View(context).apply { setBackgroundColor(p.leftBg) },
                    LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f))
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    setBackgroundColor(p.rightBg)
                    for (w in listOf(14, 22, 14)) addView(View(context).apply {
                        setBackgroundColor(if (w == 22) p.highlight else p.listText)
                    }, LinearLayout.LayoutParams(dpi(w), dpi(if (w == 22) 4 else 2)).apply {
                        setMargins(0, dpi(3), 0, dpi(3)); gravity = Gravity.END
                    })
                    setPadding(0, 0, dpi(6), 0)
                }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f))
            }
            val item = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(dpi(6), 0, dpi(6), 0)
                addView(tile, LinearLayout.LayoutParams(dpi(64), dpi(64)))
                addView(TextView(context).apply {
                    text = p.name; textSize = 12f; setPadding(0, dpi(4), 0, 0)
                })
                setOnClickListener { prefs.applyPreset(p); rebuild() }
            }
            strip.addView(item)
        }
        container.addView(HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(strip)
        })
    }

    private fun previewBox() {
        val frame = FrameLayout(this)
        val list = MagnifyListView(this)
        preview = list
        previewFrame = frame
        list.setItems(SAMPLE.map { MagnifyListView.Item(it, null) })
        frame.addView(list)
        container.addView(frame, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dpi(340)).apply {
            setMargins(dpi(20), dpi(4), dpi(20), dpi(8))
        })
        frame.clipToOutline = true
        applyPreview()
    }

    private fun applyPreview() {
        val list = preview ?: return
        val frame = previewFrame ?: return
        frame.background = GradientDrawable().apply { cornerRadius = dp(16f); setColor(prefs.leftBg) }
        list.setBackgroundColor(prefs.rightBg)
        list.textColor = prefs.listText
        list.highlightColor = prefs.highlight
        list.baseTextSizePx = sp(prefs.textSizeSp)
        list.maxScale = prefs.magnification
        list.spread = prefs.spread
        list.pill = prefs.highlightPill
        list.haptics = prefs.haptics
        list.mirrored = prefs.listOnLeft
        list.verticalBias = prefs.verticalBias
        list.setPadding(dpi(12), dpi(8), dpi(16), dpi(8))
        list.setItems(SAMPLE.take(prefs.appCount).map { MagnifyListView.Item(it, null) })
        val pct = prefs.panelPercent / 100f
        frame.post {
            val w = (frame.width * pct).toInt()
            list.layoutParams = FrameLayout.LayoutParams(w, ViewGroup.LayoutParams.MATCH_PARENT,
                if (prefs.listOnLeft) Gravity.START else Gravity.END)
        }
    }

    // ------------------------------------------------------------------ home role

    private fun isDefaultHome(): Boolean {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        @Suppress("DEPRECATION")
        val info = packageManager.resolveActivity(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
        return info?.activityInfo?.packageName == packageName
    }

    private fun requestHome() {
        if (Build.VERSION.SDK_INT >= 29) {
            val rm = getSystemService(RoleManager::class.java)
            if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_HOME) && !rm.isRoleHeld(RoleManager.ROLE_HOME)) {
                try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(rm.createRequestRoleIntent(RoleManager.ROLE_HOME), 7)
                    return
                } catch (_: Exception) { }
            }
        }
        AppActions.safeStart(this, Intent(Settings.ACTION_HOME_SETTINGS))
    }

    private companion object {
        val SAMPLE = listOf(
            "WhatsApp", "Chrome", "YouTube", "Messages", "Camera", "Spotify", "Gmail", "Maps",
            "Photos", "Phone", "Instagram", "Calendar", "Clock", "Settings", "Calculator",
            "Play Store", "Drive", "Notes", "Weather", "Files", "Banking", "Podcasts",
            "Contacts", "Translate", "Slack", "Outlook", "Teams", "Netflix", "Amazon", "Uber"
        )
    }
}
