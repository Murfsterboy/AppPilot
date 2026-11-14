package com.apppilot.launcher

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Process
import java.util.concurrent.Executors

class AppEntry(val label: String, val component: ComponentName, val icon: Bitmap?) {
    val packageName: String get() = component.packageName
    val key: String = component.flattenToShortString()
}

/** Loads installed apps and ranks them by usage. All heavy work runs off the main thread. */
class AppRepository(private val context: Context, private val prefs: Prefs) {

    private val executor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val iconCache = HashMap<String, Bitmap>() // only touched on the executor thread
    private val iconSize = context.dpi(48)

    fun loadAll(callback: (List<AppEntry>) -> Unit) = executor.execute {
        val apps = queryApps().sortedBy { it.label.lowercase() }
        main.post { callback(apps) }
    }

    fun loadRanked(limit: Int, callback: (List<AppEntry>) -> Unit) = executor.execute {
        val result = rank(queryApps()).take(limit)
        main.post { callback(result) }
    }

    fun invalidateIcons() = executor.execute { iconCache.clear() }

    fun shutdown() = executor.shutdownNow()

    fun hasUsageAccess(): Boolean {
        val ops = context.getSystemService(AppOpsManager::class.java) ?: return false
        val mode = if (Build.VERSION.SDK_INT >= 29) {
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
            @Suppress("DEPRECATION")
            ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun rank(all: List<AppEntry>): List<AppEntry> {
        val hidden = prefs.hidden
        val pinnedKeys = prefs.pinned
        val byKey = all.associateBy { it.key }
        val pinned = pinnedKeys.mapNotNull { byKey[it] }
        val scores = usageScores()
        val fallback = if (scores.isEmpty()) emptyMap() else prefs.launchScores()
        val rest = all
            .filter { it.key !in hidden && it.key !in pinnedKeys }
            .sortedWith(
                compareByDescending<AppEntry> { scores[it.packageName] ?: 0.0 }
                    .thenByDescending { fallback[it.packageName] ?: 0.0 }
                    .thenBy { it.label.lowercase() }
            )
        return pinned + rest
    }

    /** Package -> score. Uses system usage stats if allowed, otherwise AppPilot's own launch history. */
    private fun usageScores(): Map<String, Double> {
        val now = System.currentTimeMillis()
        val start = now - prefs.rankDays * Prefs.DAY_MS
        if (!hasUsageAccess()) return prefs.launchScores(now)
        val usm = context.getSystemService(UsageStatsManager::class.java) ?: return prefs.launchScores(now)
        return try {
            if (prefs.rankBy == 1) {
                usm.queryAndAggregateUsageStats(start, now)
                    .mapValues { it.value.totalTimeInForeground.toDouble() }
                    .filterValues { it > 0 }
            } else {
                // Count each time an app comes to the foreground; recent opens count a little more.
                val events = usm.queryEvents(start, now)
                val e = UsageEvents.Event()
                val counts = HashMap<String, Double>()
                var last: String? = null
                val span = (now - start).toDouble()
                while (events.hasNextEvent()) {
                    events.getNextEvent(e)
                    @Suppress("DEPRECATION")
                    if (e.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                        val p = e.packageName
                        if (p != last) {
                            val recency = (e.timeStamp - start) / span
                            counts[p] = (counts[p] ?: 0.0) + 0.5 + 0.5 * recency
                            last = p
                        }
                    }
                }
                counts
            }
        } catch (t: Throwable) {
            prefs.launchScores(now)
        }
    }

    private fun queryApps(): List<AppEntry> {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val infos: List<ResolveInfo> = if (Build.VERSION.SDK_INT >= 33) {
            pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            pm.queryIntentActivities(intent, 0)
        }
        return infos
            .filter { it.activityInfo.packageName != context.packageName }
            .map { ri ->
                val cn = ComponentName(ri.activityInfo.packageName, ri.activityInfo.name)
                val key = cn.flattenToShortString()
                val icon = iconCache[key] ?: runCatching { ri.loadIcon(pm).toBitmap(iconSize) }
                    .getOrNull()?.also { iconCache[key] = it }
                AppEntry(ri.loadLabel(pm).toString().trim(), cn, icon)
            }
            .distinctBy { it.key }
    }

    private fun Drawable.toBitmap(size: Int): Bitmap {
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        setBounds(0, 0, size, size)
        draw(canvas)
        return bmp
    }
}
