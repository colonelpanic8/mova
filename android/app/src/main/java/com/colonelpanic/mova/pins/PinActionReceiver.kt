package com.colonelpanic.mova.pins

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class PinActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pinId = intent.getStringExtra(PinManager.EXTRA_PIN_ID) ?: return
    when (intent.action) {
      PinManager.ACTION_DONE -> PinManager.complete(context, pinId)
      PinManager.ACTION_SNOOZE ->
        PinManager.snooze(
          context,
          pinId,
          intent.getIntExtra(
            PinManager.EXTRA_SNOOZE_MINUTES,
            PinManager.DEFAULT_SNOOZE_MINUTES,
          ),
        )
      PinManager.ACTION_ESCALATE -> PinManager.escalate(context, pinId)
      PinManager.ACTION_RESTORE -> PinManager.restore(context, pinId)
    }
  }
}
