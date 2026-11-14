package com.apppilot.launcher

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.ContactsContract
import android.provider.MediaStore

/**
 * Gesture shortcut targets. A value is "" (nothing), one of the built-in names below,
 * or an app's ComponentName.flattenToShortString().
 */
object Shortcuts {
    const val NONE = ""
    const val DIALER = "@dialer"
    const val CONTACTS = "@contacts"
    const val CAMERA = "@camera"
    const val ALL_APPS = "@all_apps"
    const val NOTIFICATIONS = "@notifications"
    const val SETTINGS = "@settings"

    /** Built-in choices, in the order shown in the picker. */
    val BUILT_IN = listOf(
        NONE to "Nothing",
        DIALER to "Phone (dial pad)",
        CONTACTS to "Contacts",
        CAMERA to "Camera",
        ALL_APPS to "All apps",
        NOTIFICATIONS to "Notifications",
        SETTINGS to "AppPilot settings"
    )

    fun label(context: Context, value: String): String {
        BUILT_IN.firstOrNull { it.first == value }?.let { return it.second }
        val cn = ComponentName.unflattenFromString(value) ?: return "Nothing"
        return try {
            @Suppress("DEPRECATION")
            context.packageManager.getActivityInfo(cn, 0).loadLabel(context.packageManager).toString()
        } catch (e: PackageManager.NameNotFoundException) {
            "App not installed"
        }
    }

    /** Short name for the gesture hint on the home screen, or null for "Nothing". */
    fun hint(context: Context, value: String): String? = when (value) {
        NONE -> null
        DIALER -> "phone"
        CONTACTS -> "contacts"
        CAMERA -> "camera"
        ALL_APPS -> "all apps"
        NOTIFICATIONS -> "notifications"
        SETTINGS -> "settings"
        else -> label(context, value).lowercase()
    }

    /**
     * Runs a shortcut. Returns true if it was handled. ALL_APPS / NOTIFICATIONS / SETTINGS are left to
     * the caller (via [onSpecial]) because they're home-screen actions.
     */
    fun run(activity: Activity, value: String, prefs: Prefs, onSpecial: (String) -> Unit): Boolean {
        when (value) {
            NONE -> return false
            ALL_APPS, NOTIFICATIONS, SETTINGS -> onSpecial(value)
            DIALER -> AppActions.safeStart(activity, Intent(Intent.ACTION_DIAL))
            CONTACTS -> AppActions.safeStart(activity,
                Intent(Intent.ACTION_VIEW, ContactsContract.Contacts.CONTENT_URI))
            CAMERA -> AppActions.safeStart(activity, Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA))
            else -> {
                val cn = ComponentName.unflattenFromString(value) ?: return false
                AppActions.launch(activity, AppEntry(label(activity, value), cn, null), prefs)
            }
        }
        return true
    }
}
