package com.apppilot.launcher

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.pm.LauncherApps
import android.content.pm.ShortcutInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Rect
import android.os.Process
import android.widget.Toast

/**
 * App shortcuts (the "New message", "Navigate home", WhatsApp chat or Chrome page entries apps
 * offer) placed in the home list. They're stored in the same pinned list as apps, with keys
 * "sc:<package>|<shortcut id>", and kept pinned with the system so they stay launchable.
 * Only works while AppPilot is the home screen (Android only lets the default launcher do this).
 */
object AppShortcuts {
    private const val PREFIX = "sc:"

    fun key(pkg: String, id: String) = "$PREFIX$pkg|$id"

    fun isKey(key: String) = key.startsWith(PREFIX)

    /** (package, id) from a shortcut key, or null for an app key. */
    fun parse(key: String): Pair<String, String>? {
        if (!isKey(key)) return null
        val rest = key.substring(PREFIX.length)
        val bar = rest.indexOf('|')
        if (bar <= 0 || bar == rest.length - 1) return null
        return rest.substring(0, bar) to rest.substring(bar + 1)
    }

    private fun launcherApps(context: Context) = context.getSystemService(LauncherApps::class.java)

    /** True if Android lets AppPilot read and pin shortcuts (it must be the default home app). */
    fun available(context: Context): Boolean =
        runCatching { launcherApps(context)?.hasShortcutHostPermission() == true }.getOrDefault(false)

    private const val ALL_FLAGS = LauncherApps.ShortcutQuery.FLAG_MATCH_DYNAMIC or
        LauncherApps.ShortcutQuery.FLAG_MATCH_MANIFEST or
        LauncherApps.ShortcutQuery.FLAG_MATCH_PINNED

    /** Shortcuts an app offers (what you'd see long-pressing its icon on a normal home screen). */
    fun forApp(context: Context, pkg: String): List<ShortcutInfo> {
        if (!available(context)) return emptyList()
        val q = LauncherApps.ShortcutQuery().setPackage(pkg).setQueryFlags(
            LauncherApps.ShortcutQuery.FLAG_MATCH_DYNAMIC or LauncherApps.ShortcutQuery.FLAG_MATCH_MANIFEST)
        return runCatching { launcherApps(context)!!.getShortcuts(q, Process.myUserHandle()) }
            .getOrNull().orEmpty()
            .filter { it.isEnabled }
            .sortedWith(compareBy<ShortcutInfo> { if (it.isDeclaredInManifest) 0 else 1 }.thenBy { it.rank })
    }

    /** Looks up the given shortcut keys. Missing or disabled shortcuts are left out. Call off the main thread. */
    fun resolve(context: Context, keys: List<String>, iconSize: Int): Map<String, AppEntry> {
        if (keys.isEmpty() || !available(context)) return emptyMap()
        val la = launcherApps(context) ?: return emptyMap()
        val user = Process.myUserHandle()
        val out = HashMap<String, AppEntry>()
        keys.mapNotNull { parse(it) }.groupBy({ it.first }, { it.second }).forEach { (pkg, ids) ->
            val q = LauncherApps.ShortcutQuery().setPackage(pkg).setShortcutIds(ids).setQueryFlags(ALL_FLAGS)
            val found = runCatching { la.getShortcuts(q, user) }.getOrNull().orEmpty()
            // After a restore (or if the app dropped our pin), pin them again so they keep working.
            if (found.any { !it.isPinned }) {
                val pinnedIds = runCatching {
                    la.getShortcuts(LauncherApps.ShortcutQuery().setPackage(pkg)
                        .setQueryFlags(LauncherApps.ShortcutQuery.FLAG_MATCH_PINNED), user)
                }.getOrNull().orEmpty().map { it.id }
                runCatching { la.pinShortcuts(pkg, (pinnedIds + ids).distinct(), user) }
            }
            for (s in found) {
                if (!s.isEnabled) continue
                out[key(pkg, s.id)] = entry(context, s, iconSize)
            }
        }
        return out
    }

    fun entry(context: Context, s: ShortcutInfo, iconSize: Int): AppEntry {
        val label = (s.shortLabel ?: s.longLabel)?.toString()?.trim().orEmpty().ifEmpty { s.id }
        val cn = s.activity ?: ComponentName(s.`package`, "")
        val icon = runCatching {
            launcherApps(context)?.getShortcutIconDrawable(s, context.resources.displayMetrics.densityDpi)
        }.getOrNull()?.let { d ->
            Bitmap.createBitmap(iconSize, iconSize, Bitmap.Config.ARGB_8888).also { bmp ->
                d.setBounds(0, 0, iconSize, iconSize)
                d.draw(Canvas(bmp))
            }
        }
        return AppEntry(label, cn, icon, shortcutId = s.id)
    }

    /** Adds a shortcut to the top of the list (after pinned items) and pins it with the system. */
    fun add(context: Context, prefs: Prefs, s: ShortcutInfo) {
        val k = key(s.`package`, s.id)
        if (k !in prefs.pinned) prefs.pinned = prefs.pinned + k
        syncPins(context, prefs, s.`package`)
    }

    fun remove(context: Context, prefs: Prefs, key: String) {
        prefs.pinned = prefs.pinned - key
        parse(key)?.let { syncPins(context, prefs, it.first) }
    }

    /** Tells the system exactly which of this app's shortcuts AppPilot is keeping. */
    private fun syncPins(context: Context, prefs: Prefs, pkg: String) {
        val ids = prefs.pinned.mapNotNull { parse(it) }.filter { it.first == pkg }.map { it.second }
        runCatching { launcherApps(context)?.pinShortcuts(pkg, ids, Process.myUserHandle()) }
    }

    fun launch(activity: Activity, app: AppEntry, prefs: Prefs, bounds: Rect?) {
        val id = app.shortcutId ?: return
        try {
            launcherApps(activity)!!.startShortcut(app.packageName, id, bounds, null, Process.myUserHandle())
            prefs.recordLaunch(app.packageName)
        } catch (e: Exception) {
            val msg = if (!available(activity)) "Make AppPilot your home screen to use shortcuts"
            else "Couldn't open ${app.label}"
            Toast.makeText(activity, msg, Toast.LENGTH_SHORT).show()
        }
    }
}
