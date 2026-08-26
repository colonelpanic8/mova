package com.colonelpanic.mova.pins

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.text.format.DateFormat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.colonelpanic.mova.MainActivity
import com.colonelpanic.mova.R
import java.util.Date
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Owns the full pin lifecycle natively so pins keep working when the React
 * Native runtime is dead: the ongoing notification, its Done/snooze actions,
 * and the escalation alarm all run without JS.
 */
object PinManager {
  private const val ONGOING_CHANNEL_ID = "mova_pins"
  private const val ALERT_CHANNEL_ID = "mova_pin_alerts"
  private const val NAG_INTERVAL_MS = 5 * 60 * 1000L

  const val ACTION_DONE = "com.colonelpanic.mova.pins.DONE"
  const val ACTION_SNOOZE = "com.colonelpanic.mova.pins.SNOOZE"
  const val ACTION_ESCALATE = "com.colonelpanic.mova.pins.ESCALATE"
  const val EXTRA_PIN_ID = "pinId"
  const val EXTRA_SNOOZE_MINUTES = "snoozeMinutes"
  const val DEFAULT_SNOOZE_MINUTES = 10
  const val SNOOZE_SHORT_MINUTES = 5
  const val SNOOZE_LONG_MINUTES = 30

  private val changeListeners = CopyOnWriteArrayList<() -> Unit>()

  fun addChangeListener(listener: () -> Unit) {
    changeListeners.add(listener)
  }

  fun removeChangeListener(listener: () -> Unit) {
    changeListeners.remove(listener)
  }

  /**
   * @param escalateMinutes minutes until the pin starts actively alerting;
   *   0 arms a purely passive pin, negative means "use the stored default".
   */
  fun arm(context: Context, title: String, escalateMinutes: Int): Pin {
    val effectiveMinutes =
      if (escalateMinutes < 0) PinStore.getDefaultReminderMinutes(context) else escalateMinutes
    val now = System.currentTimeMillis()
    val pin = Pin(
      id = UUID.randomUUID().toString(),
      title = title,
      createdAt = now,
      escalateAt = if (effectiveMinutes > 0) now + effectiveMinutes * 60_000L else 0L,
      escalated = false,
    )
    PinStore.upsert(context, pin)
    postNotification(context, pin)
    if (pin.escalateAt > 0) {
      scheduleAlarm(context, pin, pin.escalateAt)
    }
    notifyChanged()
    return pin
  }

  fun complete(context: Context, id: String) {
    val pin = PinStore.get(context, id) ?: return
    cancelAlarm(context, pin)
    NotificationManagerCompat.from(context).cancel(notificationId(pin))
    PinStore.remove(context, id)
    notifyChanged()
  }

  fun snooze(context: Context, id: String, minutes: Int) {
    val pin = PinStore.get(context, id) ?: return
    val effectiveMinutes = if (minutes > 0) minutes else DEFAULT_SNOOZE_MINUTES
    val updated = pin.copy(
      escalateAt = System.currentTimeMillis() + effectiveMinutes * 60_000L,
      escalated = false,
    )
    PinStore.upsert(context, updated)
    cancelAlarm(context, pin)
    scheduleAlarm(context, updated, updated.escalateAt)
    // The channel may change (alerting back to calm), which Android ignores
    // on in-place updates, so re-post fresh.
    postNotification(context, updated, fresh = true)
    notifyChanged()
  }

  /** Fired by the escalation alarm: switch to the alert channel and keep
   *  nagging every [NAG_INTERVAL_MS] until completed or snoozed. */
  fun escalate(context: Context, id: String) {
    val pin = PinStore.get(context, id) ?: return
    val updated = pin.copy(escalated = true)
    PinStore.upsert(context, updated)
    // Android keeps a notification on its original channel across in-place
    // updates, so the switch to the alert channel (and each subsequent nag)
    // must cancel and re-post to actually play a heads-up alert.
    postNotification(context, updated, fresh = true)
    scheduleAlarm(context, updated, System.currentTimeMillis() + NAG_INTERVAL_MS)
    notifyChanged()
  }

  /** Restores notifications and alarms after a reboot. Past-due pins
   *  escalate immediately. */
  fun rearmAll(context: Context) {
    val now = System.currentTimeMillis()
    PinStore.list(context).forEach { pin ->
      val duePin =
        if (!pin.escalated && pin.escalateAt in 1..now) pin.copy(escalated = true) else pin
      if (duePin != pin) PinStore.upsert(context, duePin)
      postNotification(context, duePin)
      when {
        duePin.escalated -> scheduleAlarm(context, duePin, now + NAG_INTERVAL_MS)
        duePin.escalateAt > 0 -> scheduleAlarm(context, duePin, duePin.escalateAt)
      }
    }
    if (PinStore.list(context).isNotEmpty()) {
      notifyChanged()
    }
  }

  private fun notifyChanged() {
    changeListeners.forEach { it() }
  }

  private fun postNotification(context: Context, pin: Pin, fresh: Boolean = false) {
    ensureChannels(context)
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    if (fresh) manager.cancel(notificationId(pin))

    val timeFormat = DateFormat.getTimeFormat(context)
    val text = buildString {
      append(context.getString(R.string.pin_notification_since, timeFormat.format(Date(pin.createdAt))))
      if (!pin.escalated && pin.escalateAt > 0) {
        append(" · ")
        append(
          context.getString(R.string.pin_notification_alerts_at, timeFormat.format(Date(pin.escalateAt))),
        )
      }
    }

    val channel = if (pin.escalated) ALERT_CHANNEL_ID else ONGOING_CHANNEL_ID
    val builder = NotificationCompat.Builder(context, channel)
      .setSmallIcon(R.drawable.ic_pin)
      .setContentTitle(
        if (pin.escalated) {
          context.getString(R.string.pin_notification_escalated_title, pin.title)
        } else {
          pin.title
        },
      )
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(!pin.escalated)
      .setContentIntent(contentIntent(context, pin))
      .addAction(
        0,
        context.getString(R.string.pin_action_done),
        actionIntent(context, pin, ACTION_DONE, 1),
      )
      .addAction(
        0,
        context.getString(R.string.pin_action_snooze_short),
        actionIntent(context, pin, ACTION_SNOOZE, 2, snoozeMinutes = SNOOZE_SHORT_MINUTES),
      )
      .addAction(
        0,
        context.getString(R.string.pin_action_snooze_long),
        actionIntent(context, pin, ACTION_SNOOZE, 3, snoozeMinutes = SNOOZE_LONG_MINUTES),
      )
    if (pin.escalated) {
      builder.setCategory(NotificationCompat.CATEGORY_ALARM)
    }
    manager.notify(notificationId(pin), builder.build())
  }

  private fun contentIntent(context: Context, pin: Pin): PendingIntent {
    val intent = Intent(context, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("mova://pins")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return PendingIntent.getActivity(
      context,
      notificationId(pin),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun actionIntent(
    context: Context,
    pin: Pin,
    action: String,
    requestOffset: Int,
    snoozeMinutes: Int? = null,
  ): PendingIntent {
    val intent = Intent(context, PinActionReceiver::class.java).apply {
      this.action = action
      putExtra(EXTRA_PIN_ID, pin.id)
      if (snoozeMinutes != null) putExtra(EXTRA_SNOOZE_MINUTES, snoozeMinutes)
    }
    return PendingIntent.getBroadcast(
      context,
      requestCode(pin, requestOffset),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun alarmIntent(context: Context, pin: Pin): PendingIntent {
    val intent = Intent(context, PinActionReceiver::class.java).apply {
      action = ACTION_ESCALATE
      putExtra(EXTRA_PIN_ID, pin.id)
    }
    return PendingIntent.getBroadcast(
      context,
      requestCode(pin, 4),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun requestCode(pin: Pin, offset: Int): Int =
    ((pin.id.hashCode() and 0xFFFF) shl 3) + offset

  private fun scheduleAlarm(context: Context, pin: Pin, atMillis: Long) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    // setAlarmClock fires exactly even in doze without needing the
    // SCHEDULE_EXACT_ALARM permission; a stove pin cannot tolerate the
    // multi-minute drift of inexact alarms.
    alarmManager.setAlarmClock(
      AlarmManager.AlarmClockInfo(atMillis, contentIntent(context, pin)),
      alarmIntent(context, pin),
    )
  }

  private fun cancelAlarm(context: Context, pin: Pin) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(alarmIntent(context, pin))
  }

  private fun notificationId(pin: Pin): Int =
    // Keep well clear of expo-notifications ids and leave room for the *4
    // request-code fan-out above.
    0x504E0000 or (pin.id.hashCode() and 0xFFFF)

  private fun ensureChannels(context: Context) {
    val manager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(
        ONGOING_CHANNEL_ID,
        context.getString(R.string.pin_channel_ongoing),
        NotificationManager.IMPORTANCE_LOW,
      ),
    )
    manager.createNotificationChannel(
      NotificationChannel(
        ALERT_CHANNEL_ID,
        context.getString(R.string.pin_channel_alerts),
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        enableVibration(true)
      },
    )
  }
}
