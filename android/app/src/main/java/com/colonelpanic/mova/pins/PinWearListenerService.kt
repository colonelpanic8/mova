package com.colonelpanic.mova.pins

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

const val PIN_ARM_MESSAGE_PATH = "/mova/pin/arm"

/** Arms a pin when the watch asks for one; runs without the RN runtime. */
class PinWearListenerService : WearableListenerService() {
  override fun onMessageReceived(messageEvent: MessageEvent) {
    if (messageEvent.path != PIN_ARM_MESSAGE_PATH) return
    try {
      val json = JSONObject(String(messageEvent.data, Charsets.UTF_8))
      val title = json.optString("title").trim()
      if (title.isBlank()) return
      // Missing/negative minutes mean "use the phone's default reminder".
      PinManager.arm(this, title, json.optInt("escalateMinutes", -1))
    } catch (_: Exception) {
      // Malformed request from the watch; nothing sensible to do.
    }
  }
}
