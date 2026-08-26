package com.colonelpanic.mova.pins

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class PinBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      PinManager.rearmAll(context)
    }
  }
}
