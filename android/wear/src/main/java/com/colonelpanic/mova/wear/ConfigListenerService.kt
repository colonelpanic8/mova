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
          event.type == DataEvent.TYPE_CHANGED
        }
        .forEach { event ->
          val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
          when (event.dataItem.uri.path) {
            CONFIG_PATH -> applyServerConfig(dataMap)
            ASSISTANT_CONFIG_PATH -> applyAssistantConfig(dataMap)
          }
        }
    } finally {
      dataEvents.release()
    }
  }

  private fun applyServerConfig(dataMap: com.google.android.gms.wearable.DataMap) {
    if (!dataMap.getBoolean("configured", false)) {
      MovaWearStorage.clearCredentials(this)
      return
    }

    val apiUrl = dataMap.getString("apiUrl")
    val username = dataMap.getString("username")
    val password = dataMap.getString("password")
    if (!apiUrl.isNullOrBlank() && !username.isNullOrBlank() && password != null) {
      MovaWearStorage.saveCredentials(
        this,
        apiUrl,
        username,
        password,
        dataMap.getString("customViewKey"),
        dataMap.getString("customViewName"),
      )
    }
  }

  private fun applyAssistantConfig(dataMap: com.google.android.gms.wearable.DataMap) {
    if (!dataMap.getBoolean("configured", false)) {
      MovaWearStorage.clearOpenAiSettings(this)
      return
    }

    val apiKey = dataMap.getString("apiKey")
    val model = dataMap.getString("model")
    if (!apiKey.isNullOrBlank() && !model.isNullOrBlank()) {
      MovaWearStorage.saveOpenAiSettings(this, apiKey, model)
    }
  }
}
