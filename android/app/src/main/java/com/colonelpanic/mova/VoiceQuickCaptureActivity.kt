package com.colonelpanic.mova

import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.widget.Toast
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Transparent trampoline launched by the home-screen widget mic button via the
 * mova://capture-voice deep link. It fires the system speech recognizer, submits
 * the recognized text through the same HTTP path as QuickCaptureActivity (honoring
 * the widget's template selection), shows a Toast, and finishes. It never opens
 * the React Native app.
 */
class VoiceQuickCaptureActivity : AppCompatActivity() {

    private var templateKey: String = "__quick_capture__"

    private val speechLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            handleSpeechResult(result)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val widgetId = intent?.data?.getQueryParameter("widgetId")?.toIntOrNull()
        if (widgetId != null) {
            val prefs = MovaSharedPrefs.get(this)
            templateKey = prefs.getString("widget_${widgetId}_template_key", "__quick_capture__")
                ?: "__quick_capture__"
        }

        // Only launch the recognizer on the initial creation, not after a
        // configuration change that re-delivers the result.
        if (savedInstanceState == null) {
            launchRecognizer()
        }
    }

    private fun launchRecognizer() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak your todo")
        }
        try {
            speechLauncher.launch(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Speech recognition unavailable", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun handleSpeechResult(result: ActivityResult) {
        if (result.resultCode != RESULT_OK) {
            // Cancelled by the user.
            finish()
            return
        }

        val text = result.data
            ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()
            ?.trim()

        if (text.isNullOrEmpty()) {
            finish()
            return
        }

        submitCapture(text)
    }

    private fun submitCapture(text: String) {
        CoroutineScope(Dispatchers.IO).launch {
            val result = CaptureHttp.capture(this@VoiceQuickCaptureActivity, text, templateKey)

            withContext(Dispatchers.Main) {
                val message = if (result.success) "Captured!" else (result.error ?: "Failed to capture")
                Toast.makeText(this@VoiceQuickCaptureActivity, message, Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }
}
