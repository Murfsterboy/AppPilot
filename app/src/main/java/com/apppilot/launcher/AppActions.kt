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
        actions += (if (isHidden) "Show in list" else "Hide from list") to {
            prefs.toggleHidden(app.key); onChanged()
        }
        val notifHidden = app.packageName in prefs.notifHidden
        actions += (if (notifHidden) "Show notifications in AppPilot" else "Hide notifications in AppPilot") to {
            prefs.toggleNotifHidden(app.packageName); onChanged()
        }
        actions += "System notification settings" to { openNotificationSettings(activity, app.packageName) }
        actions += "App info" to {
            safeStart(activity, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:${app.packageName}")))
        }
        actions += "Uninstall" to {
            safeStart(activity, Intent(Intent.ACTION_DELETE, Uri.parse("package:${app.packageName}")))
        }
        AlertDialog.Builder(activity, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle(app.label)
            .setItems(actions.map { it.first }.toTypedArray()) { _, which -> actions[which].second() }
            .show()
    }

    /** The system's own per-app notification settings (where an app can be blocked completely). */
    fun openNotificationSettings(activity: Activity, pkg: String) {
        safeStart(activity, Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, pkg))
    }

    fun safeStart(activity: Activity, intent: Intent) {
        try {
            activity.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(activity, "Not available on this device", Toast.LENGTH_SHORT).show()
        }
    }
}
