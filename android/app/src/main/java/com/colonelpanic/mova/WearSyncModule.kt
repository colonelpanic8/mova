package com.colonelpanic.mova

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable

private const val CONFIG_PATH = "/mova/config"

class WearSyncModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "WearSync"

  @ReactMethod
  fun syncCredentials(
    apiUrl: String,
    username: String,
    password: String,
    promise: Promise,
  ) {
    val request = PutDataMapRequest.create(CONFIG_PATH).apply {
      dataMap.putBoolean("configured", true)
      dataMap.putString("apiUrl", apiUrl)
      dataMap.putString("username", username)
      dataMap.putString("password", password)
      dataMap.putLong("updatedAt", System.currentTimeMillis())
    }.asPutDataRequest().setUrgent()

    Wearable.getDataClient(reactContext)
      .putDataItem(request)
      .addOnSuccessListener { promise.resolve(null) }
      .addOnFailureListener { error ->
        promise.reject("WEAR_SYNC_FAILED", error)
      }
  }

  @ReactMethod
  fun clearCredentials(promise: Promise) {
    val request = PutDataMapRequest.create(CONFIG_PATH).apply {
      dataMap.putBoolean("configured", false)
      dataMap.putLong("updatedAt", System.currentTimeMillis())
    }.asPutDataRequest().setUrgent()

    Wearable.getDataClient(reactContext)
      .putDataItem(request)
      .addOnSuccessListener { promise.resolve(null) }
      .addOnFailureListener { error ->
        promise.reject("WEAR_SYNC_FAILED", error)
      }
  }
}
