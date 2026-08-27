package com.colonelpanic.mova.wear

import android.content.Context
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable

/**
 * Pull-side fallback for pin presets. Data items persist in the Data Layer,
 * but the watch only hears about them through live change events; an install
 * (or update) that happened after the phone's last push never sees one. This
 * reads the persisted /mova/pin-presets item directly from the local Data
 * Layer store and saves it. Blocking; call from a background thread.
 */
object PinPresetFetcher {
  fun fetchIntoStorage(context: Context): Boolean {
    return try {
      val uri = Uri.Builder().scheme("wear").path(PIN_PRESETS_PATH).build()
      val buffer = Tasks.await(Wearable.getDataClient(context).getDataItems(uri))
      try {
        val presets = buffer
          .map { DataMapItem.fromDataItem(it).dataMap }
          .maxByOrNull { it.getLong("updatedAt", 0L) }
          ?.getString("presets")
        if (presets != null) {
          MovaWearStorage.savePinPresets(context, presets)
          true
        } else {
          false
        }
      } finally {
        buffer.release()
      }
    } catch (_: Exception) {
      false
    }
  }
}
