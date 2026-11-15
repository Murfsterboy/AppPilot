package com.apppilot.launcher

import android.app.Activity
import android.app.ActivityOptions
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Rect
import android.net.Uri
import android.provider.Settings
import android.view.View
import android.widget.Toast

object AppActions {

    fun launch(activity: Activity, app: AppEntry, prefs: Prefs, source: View? = null, bounds: Rect? = null) {
        if (app.isShortcut) {
            val screen = if (source != null && bounds != null) {
                val loc = IntArray(2).also { source.getLocationOnScreen(it) }
                Rect(bounds).apply { offset(loc[0], loc[1]) }
            } else null
            AppShortcuts.launch(activity, app, prefs, screen)
            return
        }
        val intent = Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .setComponent(app.component)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
        val options = if (source != null && bounds != null) {
            ActivityOptions.makeClipRevealAnimation(
                source, bounds.left, bounds.top, bounds.width(), bounds.height()
            ).toBundle()
        } else null
        try {
            activity.startActivity(intent, options)
            prefs.recordLaunch(app.packageName)
        } catch (e: Exception) {
            Toast.makeText(activity, "Couldn't open ${app.label}", Toast.LENGTH_SHORT).show()
        }
    }

    /** Long-press menu: pin / reorder / hide / app info / uninstall. */
    fun showMenu(activity: Activity, app: AppEntry, prefs: Prefs, onChanged: () -> Unit) {
        if (app.isShortcut) return showShortcutMenu(activity, app, prefs, onChanged)
        val pinned = prefs.pinned
        val isPinned = app.key in pinned
        val isHidden = app.key in prefs.hidden
        val actions = mutableListOf<Pair<String, () -> Unit>>()
        actions += (if (isPinned) "Unpin from top" else "Pin to top") to {
            prefs.togglePinned(app.key); onChanged()
        }
        if (isPinned && pinned.indexOf(app.key) > 0) actions += "Move pin up" to {
            prefs.movePinned(app.key, -1); onChanged()
        }
        if (isPinned && pinned.indexOf(app.key) < pinned.size - 1) actions += "Move pin down" to {
            prefs.movePinned(app.key, 1); onChanged()
        }
        actions += "Add a shortcut to the list…" to { chooseShortcut(activity, app, prefs, onChanged) }
        actions += (if (isHidden) "Show in list" else "Hide from list") to {
            prefs.toggleHidden(app.key); onChanged()
        }
        val notifHidden = app.packageName in prefs.notifHidden
        actions += (if (notifHidden) "Show notifications in AppPilot" else "Hide notifications in AppPilot") to {
            prefs.toggleNotifHidden(app.packageName); onChanged()
        }
        actions += "System notification settings" to { openNotificationSettings(activity, app.packageName) }
        actions += "App info" to { openAppInfo(activity, app.packageName) }
        actions += "Uninstall" to {
            safeStart(activity, Intent(Intent.ACTION_DELETE, Uri.parse("package:${app.packageName}")))
        }
        AlertDialog.Builder(activity, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle(app.label)
            .setItems(actions.map { it.first }.toTypedArray()) { _, which -> actions[which].second() }
            .show()
    }

    /** Long-press menu for a shortcut in the list. */
    private fun showShortcutMenu(activity: Activity, item: AppEntry, prefs: Prefs, onChanged: () -> Unit) {
        val pinned = prefs.pinned
        val i = pinned.indexOf(item.key)
        val appLabel = NotificationStore.label(activity, item.packageName)
        val actions = mutableListOf<Pair<String, () -> Unit>>()
        actions += "Open" to { launch(activity, item, prefs) }
        if (i > 0) actions += "Move up" to { prefs.movePinned(item.key, -1); onChanged() }
        if (i in 0 until pinned.size - 1) actions += "Move down" to { prefs.movePinned(item.key, 1); onChanged() }
        actions += "Remove from list" to { AppShortcuts.remove(activity, prefs, item.key); onChanged() }
        activity.packageManager.getLaunchIntentForPackage(item.packageName)?.let { intent ->
            actions += "Open $appLabel" to {
                safeStart(activity, intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                prefs.recordLaunch(item.packageName)
            }
        }
        AlertDialog.Builder(activity, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("${item.label} · $appLabel")
            .setItems(actions.map { it.first }.toTypedArray()) { _, which -> actions[which].second() }
            .show()
    }

    /** Lists the shortcuts an app offers and adds the chosen one to the top of the list. */
    fun chooseShortcut(activity: Activity, app: AppEntry, prefs: Prefs, onChanged: () -> Unit) {
        if (!AppShortcuts.available(activity)) {
            Toast.makeText(activity, "Make AppPilot your home screen to add shortcuts", Toast.LENGTH_LONG).show()
            return
        }
        val list = AppShortcuts.forApp(activity, app.packageName)
        if (list.isEmpty()) {
            AlertDialog.Builder(activity, android.R.style.Theme_Material_Dialog_Alert)
                .setTitle(app.label)
                .setMessage("${app.label} doesn't offer any shortcuts right now.\n\n" +
                    "Many apps can also add one from inside the app: look for \"Add to home screen\" or " +
                    "\"Add shortcut\" (for example on a chat, contact or web page) and it will appear in AppPilot's list.")
                .setPositiveButton(android.R.string.ok, null)
                .show()
            return
        }
        val current = prefs.pinned.toSet()
        val labels = list.map { s ->
            val name = (s.longLabel ?: s.shortLabel)?.toString() ?: s.id
            if (AppShortcuts.key(s.`package`, s.id) in current) "$name  ✓" else name
        }
        AlertDialog.Builder(activity, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Add a ${app.label} shortcut")
            .setItems(labels.toTypedArray()) { _, which ->
                val s = list[which]
                AppShortcuts.add(activity, prefs, s)
                Toast.makeText(activity, "Added \"${s.shortLabel ?: s.id}\" to the top of the list", Toast.LENGTH_SHORT).show()
                onChanged()
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    /** The system's own per-app notification settings (where an app can be blocked completely). */
    fun openNotificationSettings(activity: Activity, pkg: String) {
        safeStart(activity, Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, pkg))
    }

    fun openAppInfo(activity: Activity, pkg: String) =
        safeStart(activity, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")))

    fun safeStart(activity: Activity, intent: Intent) {
        try {
            activity.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(activity, "Not available on this device", Toast.LENGTH_SHORT).show()
        }
    }
}
