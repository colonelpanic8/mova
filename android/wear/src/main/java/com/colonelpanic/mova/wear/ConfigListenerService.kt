package com.colonelpanic.mova.wear

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

class ConfigListenerService : WearableListenerService() {
  override fun onDataChanged(dataEvents: DataEventBuffer) {
    try {
      dataEvents
        .filter { event ->
          event.type == DataEvent.TYPE_CHANGED &&
            event.dataItem.uri.path == CONFIG_PATH
        }
        .forEach { event ->
          val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
          val configured = dataMap.getBoolean("configured", false)

          if (!configured) {
            MovaWearStorage.clearCredentials(this)
            return@forEach
          }

          val apiUrl = dataMap.getString("apiUrl")
          val username = dataMap.getString("username")
          val password = dataMap.getString("password")

          if (!apiUrl.isNullOrBlank() && !username.isNullOrBlank() && password != null) {
            MovaWearStorage.saveCredentials(this, apiUrl, username, password)
          }
        }
    } finally {
      dataEvents.release()
    }
  }
}
