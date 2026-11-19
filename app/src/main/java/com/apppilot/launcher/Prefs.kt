package com.apppilot.launcher

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.pow
import kotlin.properties.ReadWriteProperty
import kotlin.reflect.KProperty

data class Preset(
    val name: String,
    val leftBg: Int,
    val leftText: Int,
    val rightBg: Int,
    val listText: Int,
    val highlight: Int
)

class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("apppilot", Context.MODE_PRIVATE)
    private val history = context.getSharedPreferences("launch_history", Context.MODE_PRIVATE)
    /** Tablets start with bigger text, a narrower list and the favourites bar (only until changed). */
    private val tablet = context.isTablet()

    // ---- Colours ----
    var leftBg by IntPref("left_bg", DEFAULT.leftBg)
    var leftText by IntPref("left_text", DEFAULT.leftText)
    var rightBg by IntPref("right_bg", DEFAULT.rightBg)
    var listText by IntPref("list_text", DEFAULT.listText)
    var highlight by IntPref("highlight", DEFAULT.highlight)
    var showWallpaper by BoolPref("wallpaper", false)
    var leftOpacity by IntPref("left_opacity", 100)
    var rightOpacity by IntPref("right_opacity", 100)

    // ---- List ----
    var appCount by IntPref("app_count", 15)
    var textSizeSp by FloatPref("text_size", if (tablet) 24f else 17f)
    var magnification by FloatPref("magnification", 2.3f)
    var spread by FloatPref("spread", 1.3f)
    var panelPercent by IntPref("panel_percent", if (tablet) 38 else 55)
    var verticalBias by FloatPref("vertical_bias", 0.55f)
    var showIcons by BoolPref("show_icons", false)
    var highlightPill by BoolPref("pill", true)
    var haptics by BoolPref("haptics", true)
    var listOnLeft by BoolPref("list_on_left", false)

    // ---- Ranking ----
    /** 0 = number of launches, 1 = screen time */
    var rankBy by IntPref("rank_by", 0)
    var rankDays by IntPref("rank_days", 14)
    /** Only re-rank when the screen turns off, so the list doesn't shuffle while you use the phone. */
    var steadyOrder by BoolPref("steady_order", true)

    // ---- Home / drawer ----
    var showClock by BoolPref("show_clock", true)
    var showDate by BoolPref("show_date", true)
    var showHint by BoolPref("show_hint", true)
    /** Row of app icons along the bottom of the clock side: pins first, then most-used. */
    var showFavouritesBar by BoolPref("favourites_bar", tablet)
    /** Size of the clock side (clock, date, notifications, hints, favourites), as a percentage. */
    var leftSizePercent by IntPref("left_size", 100)
    var autoKeyboard by BoolPref("auto_keyboard", true)
    var animateReturn by BoolPref("animate_return", true)
    var searchContacts by BoolPref("search_contacts", true)
    var askedContacts by BoolPref("asked_contacts", false)

    // ---- Notifications ----
    var notifDots by BoolPref("notif_dots", true)
    var notifCounts by BoolPref("notif_counts", true)
    /** false = dot before the app name, true = after it (towards the screen edge). */
    var notifDotAfter by BoolPref("notif_dot_after", false)
    var notifPreview by BoolPref("notif_preview", true)
    var feedEnabled by BoolPref("feed_enabled", true)
    /** 0 = clock side, 1 = list side */
    var feedSide by IntPref("feed_side", 0)
    var feedMax by IntPref("feed_max", if (tablet) 6 else 4)
    var includeOngoing by BoolPref("include_ongoing", false)
    /** Packages whose notifications AppPilot doesn't show (the phone still receives them). */
    var notifHidden: Set<String>
        get() = sp.getStringSet("notif_hidden", emptySet())!!.toSet()
        set(v) = sp.edit().putStringSet("notif_hidden", v).apply()

    fun toggleNotifHidden(pkg: String) {
        val h = notifHidden
        notifHidden = if (pkg in h) h - pkg else h + pkg
    }

    // ---- Gesture shortcuts on the clock side (see Shortcuts) ----
    var shortcutDoubleTap by StringPref("shortcut_double", "")
    var shortcutSwipeRight by StringPref("shortcut_right", Shortcuts.DIALER)
    var shortcutSwipeLeft by StringPref("shortcut_left", Shortcuts.CONTACTS)

    // ---- Pinned / hidden (keys are ComponentName.flattenToShortString()) ----
    var pinned: List<String>
        get() = sp.getString("pinned", "")!!.split('\n').filter { it.isNotBlank() }
        set(v) = sp.edit().putString("pinned", v.joinToString("\n")).apply()

    var hidden: Set<String>
        get() = sp.getStringSet("hidden", emptySet())!!.toSet()
        set(v) = sp.edit().putStringSet("hidden", v).apply()

    fun togglePinned(key: String) {
        val p = pinned.toMutableList()
        if (!p.remove(key)) {
            p.add(key)
            hidden = hidden - key
        }
        pinned = p
    }

    fun movePinned(key: String, delta: Int) {
        val p = pinned.toMutableList()
        val i = p.indexOf(key)
        val j = i + delta
        if (i < 0 || j !in p.indices) return
        p.removeAt(i)
        p.add(j, key)
        pinned = p
    }

    fun toggleHidden(key: String) {
        val h = hidden
        if (key in h) hidden = h - key else {
            hidden = h + key
            pinned = pinned - key
        }
    }

    fun applyPreset(p: Preset) {
        leftBg = p.leftBg; leftText = p.leftText
        rightBg = p.rightBg; listText = p.listText; highlight = p.highlight
    }

    fun registerListener(l: SharedPreferences.OnSharedPreferenceChangeListener) =
        sp.registerOnSharedPreferenceChangeListener(l)

    fun unregisterListener(l: SharedPreferences.OnSharedPreferenceChangeListener) =
        sp.unregisterOnSharedPreferenceChangeListener(l)

    // ---- Backup / restore ----
    fun exportJson(): String {
        val root = JSONObject()
        root.put("app", "AppPilot")
        root.put("version", 1)
        root.put("settings", toJson(sp.all))
        root.put("history", toJson(history.all))
        return root.toString(2)
    }

    /** Returns false if the text isn't an AppPilot backup. */
    fun importJson(text: String): Boolean {
        val root = runCatching { JSONObject(text) }.getOrNull() ?: return false
        if (root.optString("app") != "AppPilot") return false
        root.optJSONObject("settings")?.let { fromJson(it, sp) }
        root.optJSONObject("history")?.let { fromJson(it, history) }
        return true
    }

    private fun toJson(map: Map<String, *>): JSONObject {
        val out = JSONObject()
        for ((k, v) in map) {
            val entry = JSONObject()
            when (v) {
                is Int -> entry.put("t", "i").put("v", v)
                is Long -> entry.put("t", "l").put("v", v)
                is Float -> entry.put("t", "f").put("v", v.toDouble())
                is Boolean -> entry.put("t", "b").put("v", v)
                is String -> entry.put("t", "s").put("v", v)
                is Set<*> -> entry.put("t", "set").put("v", JSONArray(v.map { it.toString() }))
                else -> continue
            }
            out.put(k, entry)
        }
        return out
    }

    private fun fromJson(obj: JSONObject, target: SharedPreferences) {
        val e = target.edit().clear()
        for (k in obj.keys()) {
            val entry = obj.optJSONObject(k) ?: continue
            when (entry.optString("t")) {
                "i" -> e.putInt(k, entry.optInt("v"))
                "l" -> e.putLong(k, entry.optLong("v"))
                "f" -> e.putFloat(k, entry.optDouble("v").toFloat())
                "b" -> e.putBoolean(k, entry.optBoolean("v"))
                "s" -> e.putString(k, entry.optString("v"))
                "set" -> {
                    val arr = entry.optJSONArray("v") ?: JSONArray()
                    e.putStringSet(k, (0 until arr.length()).map { arr.optString(it) }.toSet())
                }
            }
        }
        e.apply()
    }

    // ---- Internal launch history (used when Usage Access isn't granted) ----
    fun recordLaunch(pkg: String, now: Long = System.currentTimeMillis()) {
        val current = decayed(history.getString(pkg, null), now)
        history.edit().putString(pkg, "${current + 1.0}|$now").apply()
    }

    fun launchScores(now: Long = System.currentTimeMillis()): Map<String, Double> =
        history.all.mapNotNull { (k, v) -> (v as? String)?.let { k to decayed(it, now) } }.toMap()

    fun clearHistory() = history.edit().clear().apply()

    private fun decayed(raw: String?, now: Long): Double {
        if (raw == null) return 0.0
        val parts = raw.split('|')
        val score = parts.getOrNull(0)?.toDoubleOrNull() ?: return 0.0
        val t = parts.getOrNull(1)?.toLongOrNull() ?: return score
        val halfLife = rankDays.coerceAtLeast(1) * DAY_MS / 2.0
        return score * 0.5.pow((now - t).coerceAtLeast(0) / halfLife)
    }

    private inner class IntPref(val key: String, val def: Int) : ReadWriteProperty<Any?, Int> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getInt(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Int) =
            sp.edit().putInt(key, value).apply()
    }

    private inner class FloatPref(val key: String, val def: Float) : ReadWriteProperty<Any?, Float> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getFloat(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Float) =
            sp.edit().putFloat(key, value).apply()
    }

    private inner class BoolPref(val key: String, val def: Boolean) : ReadWriteProperty<Any?, Boolean> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getBoolean(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Boolean) =
            sp.edit().putBoolean(key, value).apply()
    }

    private inner class StringPref(val key: String, val def: String) : ReadWriteProperty<Any?, String> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getString(key, def) ?: def
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: String) =
            sp.edit().putString(key, value).apply()
    }

    companion object {
        const val DAY_MS = 24L * 60 * 60 * 1000

        val PRESETS = listOf(
            Preset("Midnight", 0xFF0E0E10.toInt(), 0xFFEDEDED.toInt(), 0xFF18181B.toInt(), 0xFFE4E4E7.toInt(), 0xFF38BDF8.toInt()),
            Preset("Graphite", 0xFF2B2C2E.toInt(), 0xFFF2F2F2.toInt(), 0xFFE9E9EA.toInt(), 0xFF1C1C1E.toInt(), 0xFFFF6B35.toInt()),
            Preset("AMOLED", 0xFF000000.toInt(), 0xFFFFFFFF.toInt(), 0xFF000000.toInt(), 0xFFF5F5F5.toInt(), 0xFFFFD60A.toInt()),
            Preset("Paper", 0xFFF5F2EB.toInt(), 0xFF2B2B2B.toInt(), 0xFFFFFFFF.toInt(), 0xFF333333.toInt(), 0xFFE0563B.toInt()),
            Preset("Ocean", 0xFF0B1D2A.toInt(), 0xFFDDEFFF.toInt(), 0xFF102A3D.toInt(), 0xFFCFE6F5.toInt(), 0xFF4FD1C5.toInt()),
            Preset("Forest", 0xFF14201A.toInt(), 0xFFE3EFE6.toInt(), 0xFF1C2D23.toInt(), 0xFFD6E7DA.toInt(), 0xFF9BE15D.toInt()),
            Preset("Sunset", 0xFF2A1430.toInt(), 0xFFFFE9E0.toInt(), 0xFF3B1838.toInt(), 0xFFFFD9CC.toInt(), 0xFFFF8A5B.toInt()),
            Preset("Rose", 0xFFFFF0F3.toInt(), 0xFF4A1D2B.toInt(), 0xFFFFE3EA.toInt(), 0xFF5B2333.toInt(), 0xFFE11D48.toInt())
        )
        val DEFAULT = PRESETS[0]
    }
}
