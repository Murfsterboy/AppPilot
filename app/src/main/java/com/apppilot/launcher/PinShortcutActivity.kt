package com.apppilot.launcher

import android.app.Activity
import android.app.AlertDialog
import android.content.pm.LauncherApps
import android.os.Bundle
import android.widget.Toast

/**
 * Shown when another app asks to add a shortcut to the home screen (Chrome's "Add to home screen",
 * WhatsApp's "Add chat shortcut", a contact's "Add to home screen" and so on). Accepting puts the
 * shortcut at the top of AppPilot's list.
 */
class PinShortcutActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val la = getSystemService(LauncherApps::class.java)
        val request = runCatching { la?.getPinItemRequest(intent) }.getOrNull()
        val info = request?.shortcutInfo
        if (request == null || !request.isValid || request.requestType != LauncherApps.PinItemRequest.REQUEST_TYPE_SHORTCUT || info == null) {
            finish()
            return
        }
        val prefs = Prefs(this)
        val name = (info.shortLabel ?: info.longLabel)?.toString() ?: "this shortcut"
        val appLabel = NotificationStore.label(this, info.`package`)
        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Add to AppPilot?")
            .setMessage("\"$name\" from $appLabel will be added to the top of your app list. " +
                "Long-press it there to move or remove it.")
            .setPositiveButton("Add") { _, _ ->
                if (runCatching { request.accept() }.getOrDefault(false)) {
                    AppShortcuts.add(this, prefs, info)
                    Toast.makeText(this, "Added \"$name\"", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "Couldn't add \"$name\"", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton(android.R.string.cancel, null)
            .setOnDismissListener { finish() }
            .show()
    }
}
