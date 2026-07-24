package com.colonelpanic.mova

import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class QuickCaptureActivity : AppCompatActivity() {

    private lateinit var editText: EditText
    private lateinit var submitButton: Button
    private lateinit var micButton: ImageButton
    private lateinit var progressBar: ProgressBar
    private lateinit var titleText: TextView

    private var templateKey: String = "__quick_capture__"
    private var templateName: String = "Quick Capture"

    private val speechLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                val text = result.data
                    ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                    ?.firstOrNull()
                    ?.trim()
                if (!text.isNullOrEmpty()) {
                    editText.setText(text)
                    editText.setSelection(text.length)
                    submitCapture(text)
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_quick_capture)

        // Make it look like a floating dialog at the top of the screen
        window.setLayout(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT
        )
        window.setGravity(android.view.Gravity.TOP)

        // Close when tapping outside
        setFinishOnTouchOutside(true)

        titleText = findViewById(R.id.capture_title)
        editText = findViewById(R.id.capture_edit_text)
        submitButton = findViewById(R.id.capture_submit_button)
        micButton = findViewById(R.id.capture_mic_button)
        progressBar = findViewById(R.id.capture_progress)

        // Get widget ID from deep link
        val widgetId = intent?.data?.getQueryParameter("widgetId")?.toIntOrNull()

        // Load template selection for this widget
        if (widgetId != null) {
            val prefs = MovaSharedPrefs.get(this)
            templateKey = prefs.getString("widget_${widgetId}_template_key", "__quick_capture__") ?: "__quick_capture__"
            templateName = prefs.getString("widget_${widgetId}_template_name", "Quick Capture") ?: "Quick Capture"
        }

        // Update title
        titleText.text = templateName

        // Focus the edit text and show keyboard, adjusting window to stay above keyboard
        editText.requestFocus()
        window.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE or
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN
        )

        // Handle text from App Actions (Google Assistant)
        val assistantText = intent?.getStringExtra("text")
        if (!assistantText.isNullOrBlank()) {
            editText.setText(assistantText)
            editText.setSelection(assistantText.length)
        }

        submitButton.setOnClickListener {
            val text = editText.text.toString().trim()
            if (text.isNotEmpty()) {
                submitCapture(text)
            }
        }

        micButton.setOnClickListener {
            launchSpeechRecognizer()
        }

        // Handle enter key
        editText.setOnEditorActionListener { _, _, _ ->
            val text = editText.text.toString().trim()
            if (text.isNotEmpty()) {
                submitCapture(text)
            }
            true
        }
    }

    private fun launchSpeechRecognizer() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_PROMPT, templateName)
        }
        try {
            speechLauncher.launch(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Speech recognition unavailable", Toast.LENGTH_SHORT).show()
        }
    }

    private fun submitCapture(text: String) {
        // Show loading state
        editText.isEnabled = false
        submitButton.isEnabled = false
        micButton.isEnabled = false
        progressBar.visibility = android.view.View.VISIBLE

        CoroutineScope(Dispatchers.IO).launch {
            val result = CaptureHttp.capture(this@QuickCaptureActivity, text, templateKey)

            withContext(Dispatchers.Main) {
                progressBar.visibility = android.view.View.GONE

                if (result.success) {
                    Toast.makeText(this@QuickCaptureActivity, "Captured!", Toast.LENGTH_SHORT).show()
                    finish()
                } else {
                    Toast.makeText(this@QuickCaptureActivity, result.error ?: "Failed to capture", Toast.LENGTH_SHORT).show()
                    editText.isEnabled = true
                    submitButton.isEnabled = true
                    micButton.isEnabled = true
                }
            }
        }
    }
}
