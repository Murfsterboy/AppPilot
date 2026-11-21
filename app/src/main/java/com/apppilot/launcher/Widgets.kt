package com.apppilot.launcher

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Process
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast

/**
 * Home-screen widgets (weather, calendar, clocks...) shown on the clock side, under the date.
 * Their ids are kept in [Prefs.widgetIds]; the system owns the widgets themselves.
 */
class Widgets(private val activity: Activity, private val prefs: Prefs, private val onChanged: () -> Unit) {

    private val manager = AppWidgetManager.getInstance(activity)
    val host = AppWidgetHost(activity, HOST_ID)

    /** Stacks the saved widgets in [area], dropping any that no longer exist (e.g. app uninstalled). */
    fun bind(area: LinearLayout, scale: Float, textColor: Int) {
        val ids = prefs.widgetIds
        val key = ids.joinToString(",") + "/$scale/${area.width}"
        if (area.tag == key) return
        area.tag = key
        area.removeAllViews()
        val valid = mutableListOf<Int>()
        val density = activity.resources.displayMetrics.density
        for (id in ids) {
            val info = runCatching { manager.getAppWidgetInfo(id) }.getOrNull()
            if (info == null) { Log.w(TAG, "widget $id has no provider info; dropping it"); continue }
            valid += id
            val view = runCatching { host.createView(activity, id, info) }
                .onFailure { Log.w(TAG, "createView failed for $id", it) }.getOrNull() ?: continue
            // Height: the widget's own minimum, at least 90dp, at most 45% of the screen.
            val screenH = activity.resources.displayMetrics.heightPixels
            val minH = maxOf(info.minHeight, (90 * density).toInt())
            val h = minOf(minH, (screenH * 0.45f).toInt())
            val wDp = (area.width.takeIf { it > 0 } ?: (activity.resources.displayMetrics.widthPixels / 2)) / density
            val hDp = h / density
            @Suppress("DEPRECATION")
            runCatching { view.updateAppWidgetSize(Bundle(), wDp.toInt(), hDp.toInt(), wDp.toInt(), hDp.toInt()) }
            val frame = FrameLayout(activity).apply {
                contentDescription = "Widget: ${label(info)}"
                addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, h))
            }
            area.addView(frame, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, h).apply {
                topMargin = (14 * density * scale).toInt()
            })
        }
        if (valid.size != ids.size) prefs.widgetIds = valid
        area.visibility = if (area.childCount == 0) View.GONE else View.VISIBLE
    }

    fun label(info: AppWidgetProviderInfo): String {
        val pm = activity.packageManager
        val widget = runCatching { info.loadLabel(pm) }.getOrNull().orEmpty()
        val app = runCatching {
            pm.getApplicationLabel(pm.getApplicationInfo(info.provider.packageName, 0)).toString()
        }.getOrDefault(info.provider.packageName)
        return if (widget.isBlank() || widget == app) app else "$app: $widget"
    }

    // ---- Adding ----

    private var pendingId = -1

    /** Lists every widget on the phone; picking one binds it (asking permission the first time). */
    fun pick() {
        val providers = runCatching { manager.getInstalledProvidersForProfile(Process.myUserHandle()) }
            .getOrNull().orEmpty()
            .filter { it.widgetCategory and AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN != 0 }
            .map { it to label(it) }
            .sortedBy { it.second.lowercase() }
        if (providers.isEmpty()) {
            Toast.makeText(activity, "No widgets found on this device", Toast.LENGTH_SHORT).show()
            return
        }
        AlertDialog.Builder(activity, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Add a widget")
            .setItems(providers.map { it.second }.toTypedArray()) { _, which -> add(providers[which].first) }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun add(info: AppWidgetProviderInfo) {
        val id = host.allocateAppWidgetId()
        val allowed = runCatching { manager.bindAppWidgetIdIfAllowed(id, info.profile, info.provider, null) }
            .getOrDefault(false)
        Log.i(TAG, "add ${info.provider.flattenToShortString()} id=$id allowed=$allowed configure=${info.configure}")
        if (allowed) {
            configureOrSave(id, info)
        } else {
            // First time: Android asks "Allow AppPilot to create widgets?"
            pendingId = id
            val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER, info.provider)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER_PROFILE, info.profile)
            try {
                @Suppress("DEPRECATION")
                activity.startActivityForResult(intent, REQ_BIND)
            } catch (e: Exception) {
                host.deleteAppWidgetId(id)
                Toast.makeText(activity, "Couldn't add that widget", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun configureOrSave(id: Int, info: AppWidgetProviderInfo?) {
        val optional = info != null && android.os.Build.VERSION.SDK_INT >= 31 &&
            info.widgetFeatures and AppWidgetProviderInfo.WIDGET_FEATURE_CONFIGURATION_OPTIONAL != 0
        if (info?.configure != null && !optional) {
            pendingId = id
            try {
                host.startAppWidgetConfigureActivityForResult(activity, id, 0, REQ_CONFIGURE, null)
                return
            } catch (e: Exception) {
                // No usable settings screen: add it as it is.
            }
        }
        save(id)
    }

    private fun save(id: Int) {
        Log.i(TAG, "saved widget $id")
        prefs.widgetIds = prefs.widgetIds + id
        pendingId = -1
        onChanged()
    }

    /** Call from the activity's onActivityResult. Returns true if it was a widget result. */
    fun onResult(requestCode: Int, resultCode: Int): Boolean {
        if (requestCode != REQ_BIND && requestCode != REQ_CONFIGURE) return false
        val id = pendingId
        Log.i(TAG, "result request=$requestCode code=$resultCode pending=$id")
        if (id == -1) return true
        if (resultCode != Activity.RESULT_OK) {
            host.deleteAppWidgetId(id)
            pendingId = -1
            return true
        }
        if (requestCode == REQ_BIND) configureOrSave(id, manager.getAppWidgetInfo(id)) else save(id)
        return true
    }

    // ---- Removing ----

    fun chooseToRemove() {
        val ids = prefs.widgetIds
        if (ids.isEmpty()) return
        val labels = ids.map { id -> manager.getAppWidgetInfo(id)?.let { label(it) } ?: "Widget" }
        AlertDialog.Builder(activity, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Remove a widget")
            .setItems(labels.toTypedArray()) { _, which -> remove(ids[which]) }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun remove(id: Int) {
        host.deleteAppWidgetId(id)
        prefs.widgetIds = prefs.widgetIds - id
        onChanged()
    }

    companion object {
        const val TAG = "AppPilotWidgets"
        const val HOST_ID = 2048
        const val REQ_BIND = 41
        const val REQ_CONFIGURE = 42
    }
}
