package com.apppilot.launcher

import android.app.Activity
import android.app.AlertDialog
import android.app.role.RoleManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.Settings
import android.view.GestureDetector
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.view.accessibility.AccessibilityNodeInfo
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextClock
import android.widget.TextView
import kotlin.math.abs

class MainActivity : Activity() {

    private lateinit var prefs: Prefs
    private lateinit var repo: AppRepository

    private lateinit var root: LinearLayout
    private lateinit var leftPanel: FrameLayout
    private lateinit var leftContent: LinearLayout
    private lateinit var clock: TextClock
    private lateinit var date: TextClock
    private lateinit var homeBanner: TextView
    private lateinit var usageBanner: TextView
    private lateinit var notifBanner: TextView
    private lateinit var hint: TextView
    private lateinit var listView: MagnifyListView
    private lateinit var rightPanel: LinearLayout
    private lateinit var feed: NotificationFeedView

    private var apps: List<AppEntry> = emptyList()
    private var insetTop = 0
    private var insetBottom = 0
    private var arrangement = ""

    /** Set when the ranking should be recomputed on the next visit to the home screen. */
    private var rankDirty = true
    private var hadUsageAccess = false
    private var returning = false

    private val notificationListener: () -> Unit = { refreshNotifications(); updateNotifBanner() }

    /** Set once AppPilot has tried to repair a listener Android left unconnected (e.g. after an update). */
    private var reconnectTried = false

    /**
     * Some phones (notably Samsung) don't reconnect the notification listener after AppPilot is updated,
     * so access shows as allowed but nothing arrives. Ask nicely first, then force it once.
     */
    private val connectionCheck = Runnable {
        if (!NotificationStore.isConnected && NotificationStore.hasAccess(this) && !reconnectTried) {
            reconnectTried = true
            NotificationStore.reconnect(this)
            root.postDelayed({ updateNotifBanner() }, 3000)
        }
        updateNotifBanner()
    }

    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ -> rankDirty = true }

    private val packageReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            repo.invalidateIcons()
            reload()
        }
    }

    /** Re-rank while the screen is off, so the new order is ready (and never changes in front of you). */
    private val screenOffReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            rankDirty = true
            reload()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        repo = AppRepository(this, prefs)
        setupWindow()
        buildUi()

        val pkgFilter = IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_ADDED)
            addAction(Intent.ACTION_PACKAGE_REMOVED)
            addAction(Intent.ACTION_PACKAGE_CHANGED)
            addDataScheme("package")
        }
        register(packageReceiver, pkgFilter)
        register(screenOffReceiver, IntentFilter(Intent.ACTION_SCREEN_OFF))
        prefs.registerListener(prefsListener)
        NotificationStore.addListener(notificationListener)
    }

    private fun register(receiver: BroadcastReceiver, filter: IntentFilter) {
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else registerReceiver(receiver, filter)
    }

    override fun onRestart() {
        super.onRestart()
        returning = true
    }

    override fun onResume() {
        super.onResume()
        applySettings()
        updateBanners()
        NotificationStore.ensureBound(this)
        root.removeCallbacks(connectionCheck)
        root.postDelayed(connectionCheck, 2500)
        refreshNotifications()
        val usage = repo.hasUsageAccess()
        if (usage != hadUsageAccess) rankDirty = true
        hadUsageAccess = usage
        if (rankDirty || !prefs.steadyOrder || apps.isEmpty()) reload()
        if (returning && prefs.animateReturn) animateIn()
        returning = false
    }

    override fun onPause() {
        super.onPause()
        listView.reset()
        feed.collapse()
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(packageReceiver) }
        runCatching { unregisterReceiver(screenOffReceiver) }
        prefs.unregisterListener(prefsListener)
        NotificationStore.removeListener(notificationListener)
        root.removeCallbacks(connectionCheck)
        repo.shutdown()
        super.onDestroy()
    }

    @Deprecated("Home screen ignores back")
    override fun onBackPressed() {
        // We're the home screen: nothing to go back to.
    }

    // ------------------------------------------------------------------ setup

    private fun setupWindow() {
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
        }
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= 29) window.isNavigationBarContrastEnforced = false
    }

    private fun buildUi() {
        root = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }

        clock = TextClock(this).apply {
            format24Hour = "HH:mm"
            format12Hour = "h:mm"
            textSize = 58f
            typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
            includeFontPadding = false
        }
        date = TextClock(this).apply {
            format24Hour = "EEEE d MMMM"
            format12Hour = "EEEE d MMMM"
            textSize = 16f
            setPadding(0, dpi(6), 0, 0)
        }
        homeBanner = banner("Make AppPilot your home screen  ›") { requestHomeRole() }
        usageBanner = banner("Allow usage access so your most-used apps rank accurately  ›") {
            AppActions.safeStart(this, Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }

        notifBanner = banner("") {
            if (NotificationStore.hasAccess(this)) fixNotificationConnection() else openNotificationAccess()
        }

        leftContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(clock)
            addView(date)
            addView(homeBanner, bannerParams())
            addView(usageBanner, bannerParams())
            addView(notifBanner, bannerParams())
        }
        hint = TextView(this).apply {
            textSize = 12f
            alpha = 0.55f
            setLineSpacing(0f, 1.25f)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }

        leftPanel = FrameLayout(this).apply {
            addView(leftContent, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP))
            addView(hint, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.START))
        }
        leftPanel.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> leftPanel.post { updateFeedHeight() } }
        setupLeftGestures()
        setupLeftAccessibility()

        listView = MagnifyListView(this).apply {
            listener = object : MagnifyListView.Listener {
                override fun onItemClick(index: Int, bounds: Rect) {
                    apps.getOrNull(index)?.let { AppActions.launch(this@MainActivity, it, prefs, listView, bounds) }
                }

                override fun onItemLongPress(index: Int) {
                    apps.getOrNull(index)?.let { AppActions.showMenu(this@MainActivity, it, prefs) { reload() } }
                }
            }
        }

        rightPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(listView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        }

        feed = NotificationFeedView(this).apply {
            visibility = View.GONE
            addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> post { updateFeedHeight() } }
            listener = object : NotificationFeedView.Listener {
                override fun onOpen(e: NotificationEntry) = NotificationStore.open(this@MainActivity, e, prefs)
                override fun onMenu(e: NotificationEntry) = showNotificationMenu(e)
                override fun onClearAll() = NotificationStore.dismissAll(prefs)
            }
        }

        root.setOnApplyWindowInsetsListener { _, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                insetTop = bars.top; insetBottom = bars.bottom
            } else {
                @Suppress("DEPRECATION")
                insetTop = insets.systemWindowInsetTop
                @Suppress("DEPRECATION")
                insetBottom = insets.systemWindowInsetBottom
            }
            applyPadding()
            insets
        }

        setContentView(root)
    }

    private fun banner(text: String, onClick: () -> Unit) = TextView(this).apply {
        this.text = text
        textSize = 13f
        setPadding(dpi(14), dpi(10), dpi(14), dpi(10))
        setOnClickListener { onClick() }
    }

    private fun bannerParams() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dpi(20); marginEnd = dpi(8) }

    private fun applyPadding() {
        leftPanel.setPadding(dpi(28), insetTop + dpi(56), dpi(16), insetBottom + dpi(28))
        // Keep the list a little away from the screen edge so the back gesture doesn't grab it.
        val inner = dpi(18); val outer = dpi(26)
        rightPanel.setPadding(0, insetTop, 0, insetBottom)
        if (prefs.listOnLeft) {
            listView.setPadding(outer, dpi(12), inner, dpi(12))
            if (feed.parent === rightPanel) feed.setPadding(outer, dpi(16), inner, 0)
        } else {
            listView.setPadding(inner, dpi(12), outer, dpi(12))
            if (feed.parent === rightPanel) feed.setPadding(inner, dpi(16), outer, 0)
        }
        if (feed.parent === leftContent) feed.setPadding(0, 0, 0, 0)
    }

    private fun setupLeftGestures() {
        val detector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent) = true

            override fun onFling(e1: MotionEvent?, e2: MotionEvent, vx: Float, vy: Float): Boolean {
                val start = e1 ?: return false
                val dx = e2.x - start.x
                val dy = e2.y - start.y
                if (abs(dy) >= abs(dx)) {
                    if (abs(dy) < dp(40f)) return false
                    if (dy < 0) openAllApps() else expandNotifications()
                } else {
                    if (abs(dx) < dp(60f)) return false
                    runShortcut(if (dx > 0) prefs.shortcutSwipeRight else prefs.shortcutSwipeLeft)
                }
                return true
            }

            // Confirmed (not part of a double-tap), so a double-tap shortcut doesn't also open alarms.
            override fun onSingleTapConfirmed(e: MotionEvent): Boolean {
                when {
                    clock.hit(e) -> openAlarms()
                    date.hit(e) -> openCalendar()
                }
                return true
            }

            override fun onDoubleTap(e: MotionEvent): Boolean = runShortcut(prefs.shortcutDoubleTap)

            override fun onLongPress(e: MotionEvent) {
                leftPanel.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                openSettings()
            }
        })
        leftPanel.setOnTouchListener { _, e -> detector.onTouchEvent(e) }
    }

    /** Screen-reader users can't do the swipes, so expose them as actions on the clock side. */
    private fun setupLeftAccessibility() {
        val actions = listOf(
            R_ALL_APPS to "All apps",
            R_NOTIFICATIONS to "Notifications",
            R_SETTINGS to "AppPilot settings",
            R_ALARMS to "Alarms",
            R_CALENDAR to "Calendar"
        )
        leftPanel.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        leftPanel.isFocusable = true
        clock.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        date.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        leftPanel.accessibilityDelegate = object : View.AccessibilityDelegate() {
            override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfo) {
                super.onInitializeAccessibilityNodeInfo(host, info)
                info.contentDescription = "Home screen. ${clock.text}, ${date.text}. " +
                    "Use actions for all apps and settings."
                for ((id, label) in actions) info.addAction(AccessibilityNodeInfo.AccessibilityAction(id, label))
            }

            override fun performAccessibilityAction(host: View, action: Int, args: Bundle?): Boolean {
                when (action) {
                    R_ALL_APPS -> openAllApps()
                    R_NOTIFICATIONS -> expandNotifications()
                    R_SETTINGS -> openSettings()
                    R_ALARMS -> openAlarms()
                    R_CALENDAR -> openCalendar()
                    else -> return super.performAccessibilityAction(host, action, args)
                }
                return true
            }
        }
    }

    private fun runShortcut(value: String): Boolean {
        val handled = Shortcuts.run(this, value, prefs) { special ->
            when (special) {
                Shortcuts.ALL_APPS -> openAllApps()
                Shortcuts.NOTIFICATIONS -> expandNotifications()
                Shortcuts.SETTINGS -> openSettings()
            }
        }
        if (handled) leftPanel.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        return handled
    }

    private fun View.hit(e: MotionEvent): Boolean {
        if (visibility != View.VISIBLE) return false
        val r = Rect()
        return getGlobalVisibleRect(r) && r.contains(e.rawX.toInt(), e.rawY.toInt())
    }

    private fun animateIn() {
        val dir = if (prefs.listOnLeft) -1 else 1
        rightPanel.animate().cancel()
        rightPanel.alpha = 0f
        rightPanel.translationX = dir * dp(28f)
        rightPanel.animate().alpha(1f).translationX(0f).setDuration(280)
            .setInterpolator(DecelerateInterpolator(2.2f)).start()
        leftContent.animate().cancel()
        leftContent.alpha = 0f
        leftContent.translationY = dp(12f)
        leftContent.animate().alpha(1f).translationY(0f).setDuration(320).setStartDelay(40)
            .setInterpolator(DecelerateInterpolator(2f)).start()
    }

    // ------------------------------------------------------------------ settings & data

    private fun applySettings() {
        val wallpaper = prefs.showWallpaper
        val leftColor = if (wallpaper) Colors.withAlpha(prefs.leftBg, prefs.leftOpacity / 100f) else prefs.leftBg
        val rightColor = if (wallpaper) Colors.withAlpha(prefs.rightBg, prefs.rightOpacity / 100f) else prefs.rightBg
        if (wallpaper) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WALLPAPER)
            window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WALLPAPER)
            window.setBackgroundDrawable(ColorDrawable(prefs.leftBg))
        }

        leftPanel.setBackgroundColor(leftColor)
        rightPanel.setBackgroundColor(rightColor)

        val lt = prefs.leftText
        clock.setTextColor(lt); date.setTextColor(lt); hint.setTextColor(lt)
        clock.visibility = if (prefs.showClock) View.VISIBLE else View.GONE
        date.visibility = if (prefs.showDate) View.VISIBLE else View.GONE
        hint.visibility = if (prefs.showHint) View.VISIBLE else View.GONE
        hint.text = buildHint()
        for (b in listOf(homeBanner, usageBanner, notifBanner)) {
            b.setTextColor(lt)
            b.background = GradientDrawable().apply {
                cornerRadius = dp(12f)
                setColor(Colors.withAlpha(lt, 0.10f))
            }
        }

        listView.apply {
            textColor = prefs.listText
            highlightColor = prefs.highlight
            baseTextSizePx = sp(prefs.textSizeSp)
            maxScale = prefs.magnification
            spread = prefs.spread
            showIcons = prefs.showIcons
            mirrored = prefs.listOnLeft
            pill = prefs.highlightPill
            haptics = prefs.haptics
            verticalBias = prefs.verticalBias
            showBadges = prefs.notifDots
            showCounts = prefs.notifCounts
            badgeAfterName = prefs.notifDotAfter
            showPreview = prefs.notifPreview
        }
        placeFeed()

        // Arrange [clock side | list], or [list | clock side] in left-handed mode.
        // Only rebuilt when it changes, to avoid a relayout every time you come home.
        val p = prefs.panelPercent.coerceIn(25, 80)
        val key = "${prefs.listOnLeft}/$p"
        if (key != arrangement) {
            arrangement = key
            root.removeAllViews()
            val leftLp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 100f - p)
            val listLp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, p.toFloat())
            if (prefs.listOnLeft) {
                root.addView(rightPanel, listLp); root.addView(leftPanel, leftLp)
            } else {
                root.addView(leftPanel, leftLp); root.addView(rightPanel, listLp)
            }
        }
        applyPadding()
        root.requestApplyInsets()

        // Status/nav bar icons: dark icons on light backgrounds.
        val light = Colors.isLight(Colors.blend(prefs.leftBg, prefs.rightBg, 0.5f))
        setLightBars(light)
    }

    private fun buildHint(): String {
        val lines = mutableListOf("Swipe up · all apps")
        Shortcuts.hint(this, prefs.shortcutSwipeRight)?.let { lines += "Swipe right · $it" }
        Shortcuts.hint(this, prefs.shortcutSwipeLeft)?.let { lines += "Swipe left · $it" }
        Shortcuts.hint(this, prefs.shortcutDoubleTap)?.let { lines += "Double-tap · $it" }
        lines += "Hold · settings"
        return lines.joinToString("\n")
    }

    private fun setLightBars(light: Boolean) {
        if (Build.VERSION.SDK_INT >= 30) {
            val mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (light) mask else 0, mask)
        } else {
            @Suppress("DEPRECATION")
            var flags = window.decorView.systemUiVisibility
            @Suppress("DEPRECATION")
            val mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            flags = if (light) flags or mask else flags and mask.inv()
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = flags
        }
    }

    private fun reload() {
        rankDirty = false
        repo.loadRanked(prefs.appCount) { ranked ->
            if (listView.isTouching) { // never reshuffle under the finger; try again next time
                rankDirty = true
                return@loadRanked
            }
            apps = ranked
            listView.setItems(ranked.map { MagnifyListView.Item(it.label, it.icon) })
            refreshNotifications()
        }
    }

    // ------------------------------------------------------------------ notifications

    /** Puts the feed under the clock, or above the app list, per settings. */
    private fun placeFeed() {
        val target: LinearLayout? = when {
            !prefs.feedEnabled -> null
            prefs.feedSide == 1 -> rightPanel
            else -> leftContent
        }
        if (feed.parent !== target) {
            (feed.parent as? android.view.ViewGroup)?.removeView(feed)
            when (target) {
                rightPanel -> rightPanel.addView(feed, 0, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
                leftContent -> leftContent.addView(feed, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dpi(28); marginEnd = dpi(8) })
            }
        }
    }

    /** Lets the feed's cards scroll in the space they have: down to the gesture hints, or part of the list side. */
    private fun updateFeedHeight() {
        if (!::feed.isInitialized) return
        val parent = feed.parent ?: return
        if (feed.visibility != View.VISIBLE || leftPanel.height == 0) return
        val max = if (parent === rightPanel) {
            (rightPanel.height * 0.45f).toInt()
        } else {
            val hintSpace = if (hint.visibility == View.VISIBLE) hint.height + dpi(20) else 0
            val bottom = leftPanel.height - leftPanel.paddingBottom - hintSpace
            // Ignore the slide-in animation's offset so the size doesn't jump while it plays.
            val top = feed.listTopIn(leftPanel) - leftContent.translationY.toInt()
            bottom - top - feed.footerHeight
        }
        feed.maxListHeight = max.coerceAtLeast(dpi(120))
    }

    private fun refreshNotifications() {
        if (!::feed.isInitialized) return
        val visible = if (NotificationStore.isConnected) NotificationStore.visible(prefs) else emptyList()

        if (feed.parent != null) {
            val color = if (feed.parent === rightPanel) prefs.listText else prefs.leftText
            feed.bind(visible, prefs.feedMax, color, prefs.highlight)
        }

        val byPkg = visible.groupBy { it.packageName }
        // Shortcuts don't get their app's dot: a WhatsApp chat shortcut would light up for every chat.
        fun forRow(i: Int) = if (apps[i].isShortcut) null else byPkg[apps[i].packageName]
        val counts = IntArray(apps.size) { forRow(it)?.size ?: 0 }
        val latest = Array<CharSequence?>(apps.size) { forRow(it)?.firstOrNull()?.summary }
        listView.setBadges(counts, latest)
    }

    private fun showNotificationMenu(e: NotificationEntry) {
        val actions = mutableListOf<Pair<String, () -> Unit>>()
        actions += "Open" to { NotificationStore.open(this, e, prefs) }
        if (e.clearable) actions += "Dismiss" to { NotificationStore.dismiss(e) }
        actions += "Hide ${e.appLabel} notifications in AppPilot" to {
            prefs.toggleNotifHidden(e.packageName); refreshNotifications()
        }
        actions += "${e.appLabel} notification settings" to {
            AppActions.openNotificationSettings(this, e.packageName)
        }
        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle(e.appLabel)
            .setItems(actions.map { it.first }.toTypedArray()) { _, which -> actions[which].second() }
            .show()
    }

    private fun updateBanners() {
        homeBanner.visibility = if (isDefaultHome()) View.GONE else View.VISIBLE
        usageBanner.visibility = if (repo.hasUsageAccess()) View.GONE else View.VISIBLE
        updateNotifBanner()
    }

    /** Prompt while notification access is off, or on but not connected after AppPilot tried to repair it. */
    private fun updateNotifBanner() {
        if (!::notifBanner.isInitialized) return
        val wanted = prefs.notifDots || prefs.feedEnabled || prefs.notifPreview
        val access = NotificationStore.hasAccess(this)
        val text = when {
            !wanted -> null
            !access -> "Allow notification access to see dots and recent notifications  ›"
            !NotificationStore.isConnected && reconnectTried -> "Notifications aren't coming through — tap to fix  ›"
            else -> null
        }
        notifBanner.visibility = if (text == null) View.GONE else View.VISIBLE
        if (text != null) notifBanner.text = text
    }

    private fun fixNotificationConnection() {
        NotificationStore.reconnect(this)
        root.postDelayed({ updateNotifBanner() }, 3000)
        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Notifications aren't coming through")
            .setMessage("Android says AppPilot is allowed to read notifications but hasn't connected it " +
                "(this can happen after an update). AppPilot has just asked again.\n\n" +
                "If the dots still don't appear in a few seconds: open the setting, turn AppPilot off, " +
                "then on again.")
            .setPositiveButton("Open setting") { _, _ ->
                AppActions.safeStart(this, NotificationStore.accessSettingsIntent(this))
            }
            .setNegativeButton(android.R.string.ok, null)
            .show()
    }

    /** Opens the system switch, explaining first how to unlock it if Android has greyed it out. */
    private fun openNotificationAccess() {
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

    private fun isDefaultHome(): Boolean {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val info = if (Build.VERSION.SDK_INT >= 33) {
            packageManager.resolveActivity(intent, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()))
        } else {
            @Suppress("DEPRECATION")
            packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
        }
        return info?.activityInfo?.packageName == packageName
    }

    private fun requestHomeRole() {
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

    private fun openAllApps() = startActivity(Intent(this, AllAppsActivity::class.java))

    private fun openSettings() = startActivity(Intent(this, SettingsActivity::class.java))

    private fun openAlarms() = AppActions.safeStart(this, Intent(AlarmClock.ACTION_SHOW_ALARMS))

    private fun openCalendar() = AppActions.safeStart(this, Intent(Intent.ACTION_VIEW,
        CalendarContract.CONTENT_URI.buildUpon().appendPath("time").build()))

    private fun expandNotifications() {
        try {
            @Suppress("WrongConstant")
            val service = getSystemService("statusbar")
            Class.forName("android.app.StatusBarManager").getMethod("expandNotificationsPanel").invoke(service)
        } catch (_: Throwable) { }
    }

    private companion object {
        val R_ALL_APPS = R.id.action_all_apps
        val R_NOTIFICATIONS = R.id.action_notifications
        val R_SETTINGS = R.id.action_settings
        val R_ALARMS = R.id.action_alarms
        val R_CALENDAR = R.id.action_calendar
    }
}
