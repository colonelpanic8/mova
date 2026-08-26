package com.colonelpanic.mova.wear

import android.content.Context
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject

/**
 * Sends an arm-pin request to the paired phone over the Data Layer. Blocking;
 * call from a background thread. The phone owns pin state and the persistent
 * notification.
 */
object PinSender {
  fun send(context: Context, title: String, escalateMinutes: Int): Boolean {
    val payload = JSONObject()
      .put("title", title)
      .put("escalateMinutes", escalateMinutes)
      .toString()
      .toByteArray(Charsets.UTF_8)

    return try {
      val nodes = Tasks.await(Wearable.getNodeClient(context).connectedNodes)
      val target = nodes.firstOrNull { it.isNearby } ?: nodes.firstOrNull() ?: return false
      Tasks.await(
        Wearable.getMessageClient(context).sendMessage(target.id, PIN_ARM_PATH, payload),
      )
      true
    } catch (_: Exception) {
      false
    }
  }
}
