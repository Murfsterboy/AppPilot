package com.fettle.app

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Drying and contact timers. Each one is an alarm plus a saved entry, so timers
 * survive the app being closed and are set again after the phone restarts.
 * Alarms are inexact (no special permission needed); they may land a minute or two late.
 */
object Timers {
    private const val CHANNEL = "timers"
    private const val PREFS = "timers"

    fun schedule(context: Context, id: String, label: String, endMillis: Long) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(id, "$endMillis|$label").apply()
        setAlarm(context, id, label, endMillis)
    }

    fun cancel(context: Context, id: String) {
        context.getSystemService(AlarmManager::class.java).cancel(alarmIntent(context, id, ""))
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(id).apply()
    }

    fun restoreAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        for ((id, value) in prefs.all) {
            val parts = (value as? String)?.split("|", limit = 2) ?: continue
            val end = parts[0].toLongOrNull() ?: continue
            setAlarm(context, id, parts.getOrElse(1) { "Timer" }, end)
        }
    }

    private fun setAlarm(context: Context, id: String, label: String, endMillis: Long) {
        context.getSystemService(AlarmManager::class.java)
            .setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endMillis, alarmIntent(context, id, label))
    }

    private fun alarmIntent(context: Context, id: String, label: String): PendingIntent {
        val intent = Intent(context, TimerReceiver::class.java)
            .putExtra("id", id)
            .putExtra("label", label)
        return PendingIntent.getBroadcast(
            context, id.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    fun notifyDone(context: Context, id: String, label: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(id).apply()
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, context.getString(R.string.channel_timers), NotificationManager.IMPORTANCE_HIGH)
        )
        val open = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_OPEN, "projects")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val n = Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_roller)
            .setContentTitle(context.getString(R.string.timer_done_title, label))
            .setContentText(context.getString(R.string.timer_done_text))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        try {
            nm.notify(id.hashCode(), n)
        } catch (_: SecurityException) {
            // Notifications not allowed; the timer still shows as ready in the app.
        }
    }
}

class TimerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Timers.restoreAll(context)
            return
        }
        val id = intent.getStringExtra("id") ?: return
        Timers.notifyDone(context, id, intent.getStringExtra("label") ?: "Timer")
    }
}
