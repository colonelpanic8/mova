package com.colonelpanic.mova.wear

import android.os.Bundle

class VoiceCaptureActivity : MainActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (savedInstanceState == null) {
      window.decorView.post {
        launchVoiceCapture()
      }
    }
  }
}
