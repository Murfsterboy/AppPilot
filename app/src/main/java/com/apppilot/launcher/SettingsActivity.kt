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

        header("Notifications")
        val notifAccess = NotificationStore.hasAccess(this)
        val connected = NotificationStore.isConnected
        action("Notification access", when {
            notifAccess && connected -> {
                val shown = NotificationStore.visible(prefs).size
                val total = NotificationStore.totalCount
                "Allowed ✓ — connected. Right now: $shown notification${if (shown == 1) "" else "s"} to show" +
                    if (total > shown) " ($total on the phone; the rest are hidden by your choices below or ongoing)" else ""
            }
            notifAccess -> "Allowed, but Android hasn't connected AppPilot yet — tap to reconnect"
            else -> "Not allowed — tap to let AppPilot show notification dots, previews and the feed"
        }) {
            if (notifAccess && !connected) {
                NotificationStore.reconnect(this)
                Toast.makeText(this, "Reconnecting… if the dots still don't appear, turn notification access off and on again",
                    Toast.LENGTH_LONG).show()
                window.decorView.postDelayed({ rebuild() }, 1500)
            } else {
                AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                    .setTitle("Notification access")
                    .setMessage(NotificationStore.ACCESS_HELP)
                    .setPositiveButton("Open setting") { _, _ ->
                        AppActions.safeStart(this, NotificationStore.accessSettingsIntent(this))
                    }
                    .setNeutralButton("App info") { _, _ -> AppActions.openAppInfo(this, packageName) }
                    .setNegativeButton(android.R.string.cancel, null)
                    .show()
            }
        }
        if (!notifAccess) note("Greyed out? App info → ⋮ → Allow restricted settings, then try again.")
        action("Choose which apps show notifications", notifAppsSummary()) { chooseNotificationApps() }
        note("This only controls what AppPilot shows. To stop an app notifying you at all, long-press it and choose System notification settings.")
        switch("Dots in the app list", "A dot next to apps with notifications", prefs.notifDots) {
            prefs.notifDots = it; rebuild()
        }
        if (prefs.notifDots) {
            switch("Show counts", "A number instead of a dot when there's more than one", prefs.notifCounts) {
                prefs.notifCounts = it
            }
            choice("Dot position", listOf("Before the app name", "After the app name (by the edge)"),
                if (prefs.notifDotAfter) 1 else 0) { prefs.notifDotAfter = it == 1 }
        }
        switch("Preview while dragging", "The magnified app shows its latest notification", prefs.notifPreview) {
            prefs.notifPreview = it
        }
        switch("Notification feed", "Recent notifications on the home screen", prefs.feedEnabled) {
            prefs.feedEnabled = it; rebuild()
        }
        if (prefs.feedEnabled) {
            val clockSide = if (prefs.listOnLeft) "Right side, under the clock" else "Left side, under the clock"
            val listSide = if (prefs.listOnLeft) "Left side, above the app list" else "Right side, above the app list"
            choice("Feed position", listOf(clockSide, listSide), prefs.feedSide.coerceIn(0, 1)) { prefs.feedSide = it }
            slider("Feed size", 1f, 8f, 1f, prefs.feedMax.toFloat(), {
                "${it.toInt()} notification${if (it.toInt() == 1) "" else "s"}"
            }) { prefs.feedMax = it.toInt() }
        }
        switch("Include ongoing notifications", "Music players, navigation, downloads and similar", prefs.includeOngoing) {
            prefs.includeOngoing = it
        }

        header("Ranking")
        choice("Rank apps by", listOf("Times opened", "Screen time"), prefs.rankBy) { prefs.rankBy = it }
        switch("Keep order steady", "Only re-rank while the screen is off, so apps never move as you reach for them",
            prefs.steadyOrder) { prefs.steadyOrder = it }
        val days = listOf(1, 3, 7, 14, 30)
        choice("Look back over", days.map { if (it == 1) "Last 24 hours" else "Last $it days" },
            days.indexOf(prefs.rankDays).coerceAtLeast(0)) { prefs.rankDays = days[it] }
        note("Long-press any app (in the list or the all-apps screen) to pin it to the top, reorder pins, or hide it.")
        note("Shortcuts: long-press an app in the list → \"Add a shortcut to the list…\" (e.g. a WhatsApp chat, " +
            "Maps directions home). \"Add to home screen\" inside apps like Chrome or Contacts also adds to the list. " +
            "Needs AppPilot to be your home screen.")
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

        header("Gesture shortcuts (clock side)")
        shortcut("Swipe right", prefs.shortcutSwipeRight) { prefs.shortcutSwipeRight = it }
        shortcut("Swipe left", prefs.shortcutSwipeLeft) { prefs.shortcutSwipeLeft = it }
        shortcut("Double-tap", prefs.shortcutDoubleTap) { prefs.shortcutDoubleTap = it }

        header("Home screen")
        switch("Show clock", "Tap the clock to open alarms", prefs.showClock) { prefs.showClock = it }
        switch("Show date", "Tap the date to open your calendar", prefs.showDate) { prefs.showDate = it }
        switch("Show gesture hints", null, prefs.showHint) { prefs.showHint = it }
        switch("Open keyboard in all-apps", "Start typing to search straight away", prefs.autoKeyboard) {
            prefs.autoKeyboard = it
        }
        val contactsOn = checkSelfPermission(android.Manifest.permission.READ_CONTACTS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        switch("Search contacts in all-apps",
            if (contactsOn) "Find people as you type, with call and message buttons"
            else "Find people as you type (asks for contacts access the first time)",
            prefs.searchContacts) { prefs.searchContacts = it }
        switch("Animate on return", "The list fades and slides in when you come back home", prefs.animateReturn) {
            prefs.animateReturn = it
        }
        note("Clock side: swipe up for all apps, swipe down for notifications, hold for settings.")

        header("Backup")
        action("Back up settings", "Save colours, pins, hidden apps and shortcuts to a file") {
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/json")
                .putExtra(Intent.EXTRA_TITLE, "apppilot-backup.json")
            startForResult(intent, REQ_BACKUP)
        }
        action("Restore settings", "Load a backup file (replaces your current settings)") {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("*/*")
            startForResult(intent, REQ_RESTORE)
        }

        header("About")
        val version = runCatching { packageManager.getPackageInfo(packageName, 0).versionName }.getOrNull() ?: "?"
        note("AppPilot version $version. Mention this number when you send feedback.")

        scroll.post { scroll.scrollTo(0, y) }
    }

    private fun notifAppsSummary(): String {
        val n = prefs.notifHidden.size
        return if (n == 0) "All apps" else "$n app${if (n == 1) "" else "s"} hidden"
    }

    private fun chooseNotificationApps() {
        repo.loadAll { apps ->
            val hidden = prefs.notifHidden
            // Include hidden packages that aren't launchable apps (e.g. system services) so they can be re-enabled.
            val extra = hidden.filter { pkg -> apps.none { it.packageName == pkg } }
            val pkgs = (apps.map { it.packageName } + extra).distinct()
            val labels = pkgs.map { pkg -> apps.firstOrNull { it.packageName == pkg }?.label ?: NotificationStore.label(this, pkg) }
            val order = pkgs.indices.sortedBy { labels[it].lowercase() }
            val sortedPkgs = order.map { pkgs[it] }
            val sortedLabels = order.map { labels[it] }.toTypedArray()
            val checked = BooleanArray(sortedPkgs.size) { sortedPkgs[it] !in hidden }
            AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                .setTitle("Show notifications from")
                .setMultiChoiceItems(sortedLabels, checked) { _, which, isChecked -> checked[which] = isChecked }
                .setPositiveButton("Save") { _, _ ->
                    prefs.notifHidden = sortedPkgs.filterIndexed { i, _ -> !checked[i] }.toSet()
                    rebuild()
                }
                .setNeutralButton("All") { _, _ -> prefs.notifHidden = emptySet(); rebuild() }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    private fun startForResult(intent: Intent, code: Int) {
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, code)
        } catch (e: Exception) {
            Toast.makeText(this, "No file picker available", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        val uri = data?.data
        if (resultCode != RESULT_OK || uri == null) return
        when (requestCode) {
            REQ_BACKUP -> {
                val ok = runCatching {
                    contentResolver.openOutputStream(uri, "wt")!!.use { it.write(prefs.exportJson().toByteArray()) }
                }.isSuccess
                Toast.makeText(this, if (ok) "Settings backed up" else "Couldn't save the backup", Toast.LENGTH_SHORT).show()
            }
            REQ_RESTORE -> {
                val text = runCatching {
                    contentResolver.openInputStream(uri)!!.use { it.readBytes().toString(Charsets.UTF_8) }
                }.getOrNull()
                val ok = text != null && prefs.importJson(text)
                Toast.makeText(this, if (ok) "Settings restored" else "That isn't an AppPilot backup",
                    Toast.LENGTH_SHORT).show()
                if (ok) rebuild()
            }
        }
    }

    // ------------------------------------------------------------------ row builders

    private fun shortcut(title: String, value: String, set: (String) -> Unit) {
        row(title, Shortcuts.label(this, value), null) {
            repo.loadAll { apps ->
                val labels = Shortcuts.BUILT_IN.map { it.second } + apps.map { it.label }
                val values = Shortcuts.BUILT_IN.map { it.first } + apps.map { it.key }
                AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                    .setTitle(title)
                    .setSingleChoiceItems(labels.toTypedArray(), values.indexOf(value)) { d, which ->
                        set(values[which]); d.dismiss(); rebuild()
                    }
                    .show()
            }
        }
    }

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
        const val REQ_BACKUP = 31
        const val REQ_RESTORE = 32
        val SAMPLE = listOf(
            "WhatsApp", "Chrome", "YouTube", "Messages", "Camera", "Spotify", "Gmail", "Maps",
            "Photos", "Phone", "Instagram", "Calendar", "Clock", "Settings", "Calculator",
            "Play Store", "Drive", "Notes", "Weather", "Files", "Banking", "Podcasts",
            "Contacts", "Translate", "Slack", "Outlook", "Teams", "Netflix", "Amazon", "Uber"
        )
    }
}
