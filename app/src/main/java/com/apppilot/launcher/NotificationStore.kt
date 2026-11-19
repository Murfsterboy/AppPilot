package com.apppilot.launcher

import android.app.Notification
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/** One notification as AppPilot shows it. */
class NotificationEntry(
    val key: String,
    val packageName: String,
    val appLabel: String,
    val title: String,
    val text: String,
    val time: Long,
    val ongoing: Boolean,
    val clearable: Boolean,
    val autoCancel: Boolean,
    val contentIntent: PendingIntent?,
    val smallIcon: Icon?
) {
    /** Single-line summary used for list previews. */
    val summary: String get() = listOf(title, text).filter { it.isNotBlank() }.joinToString(": ")
}

/**
 * In-memory copy of the phone's active notifications, filled by [NotificationService].
 * Everything here runs on the main thread (the listener's callbacks arrive there).
 */
object NotificationStore {
    private var entries: List<NotificationEntry> = emptyList()
    private val listeners = LinkedHashSet<() -> Unit>()
    private var service: NotificationService? = null

    val isConnected: Boolean get() = service != null

    /** How many notifications the phone has right now (before AppPilot's filters). */
    val totalCount: Int get() = entries.size

    fun addListener(l: () -> Unit) { listeners += l }
    fun removeListener(l: () -> Unit) { listeners -= l }

    internal fun attach(s: NotificationService) { service = s }

    internal fun detach(s: NotificationService) {
        if (service === s) {
            service = null
            set(emptyList())
        }
    }

    internal fun set(list: List<NotificationEntry>) {
        entries = list
        listeners.toList().forEach { it() }
    }

    /** Notifications AppPilot should show, newest first, after the user's filters. */
    fun visible(prefs: Prefs): List<NotificationEntry> {
        val hidden = prefs.notifHidden
        val ongoing = prefs.includeOngoing
        return entries.filter { it.packageName !in hidden && (ongoing || !it.ongoing) }.sortedByDescending { it.time }
    }

    fun dismiss(e: NotificationEntry) {
        runCatching { service?.cancelNotification(e.key) }
    }

    fun dismissAll(prefs: Prefs) {
        visible(prefs).filter { it.clearable }.forEach { dismiss(it) }
    }

    /** Opens what the notification points to (like tapping it in the shade). */
    fun open(context: Context, e: NotificationEntry, prefs: Prefs) {
        val sent = e.contentIntent?.let { pi ->
            runCatching { pi.send(context, 0, null, null, null, null, launchOptions()) }.isSuccess
        } ?: false
        if (!sent) {
            context.packageManager.getLaunchIntentForPackage(e.packageName)?.let {
                runCatching { context.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            }
        }
        if (e.autoCancel) dismiss(e)
        prefs.recordLaunch(e.packageName)
    }

    /**
     * From Android 14, an app that fires another app's notification action must say it allows that
     * action to open a screen. Without this, tapping a WhatsApp or Outlook notification in the feed
     * silently does nothing (only exempt apps, like the default SMS app, got through).
     */
    private fun launchOptions(): android.os.Bundle? {
        if (Build.VERSION.SDK_INT < 34) return null
        return android.app.ActivityOptions.makeBasic().apply {
            @Suppress("DEPRECATION")
            setPendingIntentBackgroundActivityStartMode(
                android.app.ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
        }.toBundle()
    }

    // ---- Permission ----

    /** Android 13+ greys out the switch for apps installed from an APK until you unlock it. */
    const val ACCESS_HELP =
        "Turn on AppPilot in the next screen.\n\n" +
        "If the switch is greyed out or says \"Restricted setting\": go back, tap App info, " +
        "tap ⋮ (top right) → \"Allow restricted settings\", confirm, then try again. " +
        "Android does this for apps installed from an APK rather than the Play Store."

    fun component(context: Context) = ComponentName(context, NotificationService::class.java)

    fun hasAccess(context: Context): Boolean {
        val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
        val me = component(context)
        return enabled.split(':').any { ComponentName.unflattenFromString(it) == me }
    }

    fun accessSettingsIntent(context: Context): Intent =
        if (Build.VERSION.SDK_INT >= 30) {
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component(context).flattenToString())
        } else {
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        }

    /** If access is granted but the system hasn't connected us yet (e.g. after an update), ask it to. */
    fun ensureBound(context: Context) {
        if (!isConnected && hasAccess(context)) {
            runCatching { NotificationListenerService.requestRebind(component(context)) }
        }
    }

    /** Forces a fresh connection by briefly disabling and re-enabling the listener component. */
    fun reconnect(context: Context) {
        val pm = context.packageManager
        val cn = component(context)
        runCatching {
            pm.setComponentEnabledSetting(cn, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                android.content.pm.PackageManager.DONT_KILL_APP)
            pm.setComponentEnabledSetting(cn, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                android.content.pm.PackageManager.DONT_KILL_APP)
        }
        runCatching { NotificationListenerService.requestRebind(cn) }
    }

    // ---- Conversion ----

    private val labelCache = HashMap<String, String>()

    internal fun toEntries(context: Context, sbns: Array<StatusBarNotification>): List<NotificationEntry> {
        // Skip a group's summary when the group's individual notifications are also present.
        val groupsWithChildren = sbns
            .filter { it.notification.flags and Notification.FLAG_GROUP_SUMMARY == 0 && it.groupKey != null }
            .map { it.groupKey }.toSet()
        return sbns.mapNotNull { sbn ->
            val n = sbn.notification
            if (sbn.packageName == context.packageName) return@mapNotNull null
            val isSummary = n.flags and Notification.FLAG_GROUP_SUMMARY != 0
            if (isSummary && sbn.groupKey in groupsWithChildren) return@mapNotNull null
            val extras = n.extras
            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
            val text = (extras.getCharSequence(Notification.EXTRA_TEXT)
                ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT))?.toString().orEmpty()
            if (title.isBlank() && text.isBlank()) return@mapNotNull null
            NotificationEntry(
                key = sbn.key,
                packageName = sbn.packageName,
                appLabel = label(context, sbn.packageName),
                title = title.trim(),
                text = text.trim().replace('\n', ' '),
                time = if (n.`when` > 0) n.`when` else sbn.postTime,
                ongoing = sbn.isOngoing,
                clearable = sbn.isClearable,
                autoCancel = n.flags and Notification.FLAG_AUTO_CANCEL != 0,
                contentIntent = n.contentIntent,
                smallIcon = n.smallIcon
            )
        }
    }

    fun label(context: Context, pkg: String): String = labelCache.getOrPut(pkg) {
        runCatching {
            val pm = context.packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
        }.getOrDefault(pkg)
    }
}

class NotificationService : NotificationListenerService() {
    override fun onListenerConnected() {
        NotificationStore.attach(this)
        refresh()
    }

    override fun onListenerDisconnected() {
        NotificationStore.detach(this)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) = refresh()

    override fun onNotificationRemoved(sbn: StatusBarNotification?) = refresh()

    private fun refresh() {
        val active = runCatching { activeNotifications }.getOrNull() ?: return
        NotificationStore.set(NotificationStore.toEntries(this, active))
    }
}
