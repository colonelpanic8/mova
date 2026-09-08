package com.colonelpanic.mova.pins

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PinNotificationTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val context = instrumentation.targetContext
  private val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  private val pins = mutableListOf<Pin>()

  @Before
  fun grantNotifications() {
    if (Build.VERSION.SDK_INT >= 33) {
      instrumentation.uiAutomation.grantRuntimePermission(context.packageName, Manifest.permission.POST_NOTIFICATIONS)
    }
  }

  @After
  fun completePins() {
    pins.forEach { PinManager.complete(context, it.id) }
  }

  private fun arm(minutes: Int): Pin =
    PinManager.arm(context, "Pin notification regression ${System.nanoTime()}", minutes).also { pins.add(it) }

  private fun notification(pin: Pin) =
    manager.activeNotifications.firstOrNull {
      it.notification.extras.getString(Notification.EXTRA_TITLE)?.contains(pin.title) == true
    }

  private fun awaitCondition(condition: () -> Boolean) {
    val deadline = SystemClock.uptimeMillis() + 5_000
    while (!condition() && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(25)
    assertTrue("Notification state did not settle", condition())
  }

  @Test
  fun passivePinAppearsImmediatelyAndDoneRemovesIt() {
    val pin = arm(0)
    awaitCondition { notification(pin) != null }
    val posted = notification(pin)!!.notification
    assertTrue(posted.flags and Notification.FLAG_ONGOING_EVENT != 0)
    assertEquals(0, posted.flags and Notification.FLAG_AUTO_CANCEL)
    assertEquals(0L, pin.escalateAt)
    assertNotNull(posted.deleteIntent)

    posted.actions[0].actionIntent.send()
    awaitCondition { notification(pin) == null && PinStore.get(context, pin.id) == null }
    PinActionReceiver().onReceive(
      context,
      Intent(PinManager.ACTION_RESTORE).putExtra(PinManager.EXTRA_PIN_ID, pin.id),
    )
    assertNull(notification(pin))
  }

  @Test
  fun dismissedPinReturnsWithoutChangingItsReminder() {
    val pin = arm(30)
    awaitCondition { notification(pin) != null }
    val posted = notification(pin)!!
    manager.cancel(posted.id)
    awaitCondition { notification(pin) == null }
    posted.notification.deleteIntent.send()
    awaitCondition { notification(pin) != null }
    assertEquals(pin, PinStore.get(context, pin.id))
  }

  @Test
  fun snoozeKeepsNotificationAndCompletionDoesNotAffectOtherPins() {
    val pin = arm(30)
    val other = arm(0)
    PinManager.escalate(context, pin.id)
    awaitCondition { notification(pin)?.notification?.channelId == "mova_pin_alerts" }
    PinManager.snooze(context, pin.id, 5)
    awaitCondition { notification(pin)?.notification?.channelId == "mova_pins" }
    assertFalse(PinStore.get(context, pin.id)!!.escalated)
    PinManager.complete(context, pin.id)
    awaitCondition { notification(pin) == null }
    assertNotNull(notification(other))
  }

  @Test
  fun upgradeRestoresUnfinishedPinsAndLeavesCompletedPinsGone() {
    val active = arm(0)
    val done = arm(0)
    PinManager.complete(context, done.id)
    awaitCondition { notification(active) != null }
    manager.cancel(notification(active)!!.id)
    awaitCondition { notification(active) == null }

    PinBootReceiver().onReceive(context, Intent(Intent.ACTION_MY_PACKAGE_REPLACED))

    awaitCondition { notification(active) != null }
    assertNull(notification(done))
    assertNull(PinStore.get(context, done.id))
  }
}
