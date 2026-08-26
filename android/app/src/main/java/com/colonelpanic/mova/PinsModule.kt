package com.colonelpanic.mova

import com.colonelpanic.mova.pins.Pin
import com.colonelpanic.mova.pins.PinManager
import com.colonelpanic.mova.pins.PinStore
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable

private const val PIN_PRESETS_PATH = "/mova/pin-presets"
private const val PINS_CHANGED_EVENT = "movaPinsChanged"

class PinsModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val changeListener: () -> Unit = {
    if (reactContext.hasActiveReactInstance()) {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(PINS_CHANGED_EVENT, null)
    }
  }

  override fun getName(): String = "MovaPins"

  override fun initialize() {
    super.initialize()
    PinManager.addChangeListener(changeListener)
  }

  override fun invalidate() {
    PinManager.removeChangeListener(changeListener)
    super.invalidate()
  }

  @ReactMethod
  fun list(promise: Promise) {
    val array = Arguments.createArray()
    PinStore.list(reactContext)
      .sortedBy { it.createdAt }
      .forEach { array.pushMap(it.toMap()) }
    promise.resolve(array)
  }

  @ReactMethod
  fun arm(title: String, escalateMinutes: Double, promise: Promise) {
    val trimmed = title.trim()
    if (trimmed.isEmpty()) {
      promise.reject("PIN_EMPTY_TITLE", "Pin title must not be empty")
      return
    }
    val pin = PinManager.arm(reactContext, trimmed, escalateMinutes.toInt())
    promise.resolve(pin.toMap())
  }

  @ReactMethod
  fun complete(id: String, promise: Promise) {
    PinManager.complete(reactContext, id)
    promise.resolve(null)
  }

  @ReactMethod
  fun snooze(id: String, minutes: Double, promise: Promise) {
    PinManager.snooze(reactContext, id, minutes.toInt())
    promise.resolve(null)
  }

  @ReactMethod
  fun getDefaultReminderMinutes(promise: Promise) {
    promise.resolve(PinStore.getDefaultReminderMinutes(reactContext))
  }

  @ReactMethod
  fun setDefaultReminderMinutes(minutes: Double, promise: Promise) {
    PinStore.setDefaultReminderMinutes(reactContext, minutes.toInt())
    promise.resolve(null)
  }

  /** Pushes the preset list (a JSON array string) to the watch. */
  @ReactMethod
  fun syncPresets(presetsJson: String, promise: Promise) {
    val request = PutDataMapRequest.create(PIN_PRESETS_PATH).apply {
      dataMap.putString("presets", presetsJson)
      dataMap.putLong("updatedAt", System.currentTimeMillis())
    }.asPutDataRequest().setUrgent()

    Wearable.getDataClient(reactContext)
      .putDataItem(request)
      .addOnSuccessListener { promise.resolve(null) }
      .addOnFailureListener { error ->
        promise.reject("PIN_PRESET_SYNC_FAILED", error)
      }
  }

  // NativeEventEmitter requires these even with RCTDeviceEventEmitter.
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  private fun Pin.toMap(): WritableMap =
    Arguments.createMap().apply {
      putString("id", id)
      putString("title", title)
      putDouble("createdAt", createdAt.toDouble())
      putDouble("escalateAt", escalateAt.toDouble())
      putBoolean("escalated", escalated)
    }
}
