package com.anonymous.mova

import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import android.util.Base64
import org.json.JSONObject

private const val TAG = "QuickCaptureActivity"

class QuickCaptureActivity : AppCompatActivity() {

    private lateinit var editText: EditText
    private lateinit var submitButton: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var titleText: TextView

    private var templateKey: String = "__quick_capture__"
    private var templateName: String = "Quick Capture"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_quick_capture)

        // Make it look like a floating dialog
        window.setLayout(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT
        )

        // Close when tapping outside
        setFinishOnTouchOutside(true)

        titleText = findViewById(R.id.capture_title)
        editText = findViewById(R.id.capture_edit_text)
        submitButton = findViewById(R.id.capture_submit_button)
        progressBar = findViewById(R.id.capture_progress)

        // Get widget ID from deep link
        val widgetId = intent?.data?.getQueryParameter("widgetId")?.toIntOrNull()

        // Load template selection for this widget
        if (widgetId != null) {
            val prefs = getSharedPreferences("mova_widget_prefs", MODE_PRIVATE)
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

        submitButton.setOnClickListener {
            val text = editText.text.toString().trim()
            if (text.isNotEmpty()) {
                submitCapture(text)
            }
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

    private fun submitCapture(text: String) {
        // Show loading state
        editText.isEnabled = false
        submitButton.isEnabled = false
        progressBar.visibility = android.view.View.VISIBLE

        CoroutineScope(Dispatchers.IO).launch {
            // Use "default" template if no template is selected or if it was the old quick capture
            val effectiveTemplateKey = if (templateKey == "__quick_capture__" || templateKey.isNullOrEmpty()) {
                "default"
            } else {
                templateKey!!
            }
            val result = captureWithTemplate(text, effectiveTemplateKey)

            withContext(Dispatchers.Main) {
                progressBar.visibility = android.view.View.GONE

                if (result.success) {
                    Toast.makeText(this@QuickCaptureActivity, "Captured!", Toast.LENGTH_SHORT).show()
                    finish()
                } else {
                    Toast.makeText(this@QuickCaptureActivity, result.error ?: "Failed to capture", Toast.LENGTH_SHORT).show()
                    editText.isEnabled = true
                    submitButton.isEnabled = true
                }
            }
        }
    }

    private fun getCredentials(): Triple<String, String, String>? {
        val prefs = getSharedPreferences("mova_widget_prefs", MODE_PRIVATE)
        val apiUrl = prefs.getString("mova_api_url", null)
        val username = prefs.getString("mova_username", null)
        val password = prefs.getString("mova_password", null)

        return if (apiUrl != null && username != null && password != null) {
            Triple(apiUrl, username, password)
        } else {
            null
        }
    }

    private fun captureWithTemplate(text: String, templateKeyToUse: String): CaptureResult {
        try {
            val credentials = getCredentials()
                ?: return CaptureResult(false, "Please log in to the Mova app first")

            val (apiUrl, username, password) = credentials

            // First fetch the template to find the field name
            val fieldName = getTemplateFieldName(apiUrl, username, password, templateKeyToUse)
                ?: return CaptureResult(false, "Failed to load template")

            val url = URL("$apiUrl/capture")
            val connection = url.openConnection() as HttpURLConnection

            try {
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")

                val basicAuth = "Basic " + Base64.encodeToString("$username:$password".toByteArray(), Base64.NO_WRAP)
                connection.setRequestProperty("Authorization", basicAuth)

                connection.doOutput = true
                connection.outputStream.use { os ->
                    val values = JSONObject().apply {
                        put(fieldName, text)
                    }
                    val jsonBody = JSONObject().apply {
                        put("template", templateKeyToUse)
                        put("values", values)
                    }.toString()
                    os.write(jsonBody.toByteArray())
                }

                val responseCode = connection.responseCode

                return when {
                    responseCode in 200..299 -> CaptureResult(true)
                    responseCode == 401 -> CaptureResult(false, "Authentication failed")
                    else -> {
                        val errorBody = try {
                            connection.errorStream?.bufferedReader()?.readText()
                        } catch (e: Exception) { null }
                        CaptureResult(false, "Server error: $responseCode - $errorBody")
                    }
                }
            } finally {
                connection.disconnect()
            }
        } catch (e: Exception) {
            return CaptureResult(false, "Network error: ${e.message}")
        }
    }

    private fun getTemplateFieldName(apiUrl: String, username: String, password: String, templateKeyToUse: String): String? {
        try {
            val url = URL("$apiUrl/capture-templates")
            val connection = url.openConnection() as HttpURLConnection

            try {
                connection.requestMethod = "GET"
                val basicAuth = "Basic " + Base64.encodeToString("$username:$password".toByteArray(), Base64.NO_WRAP)
                connection.setRequestProperty("Authorization", basicAuth)

                if (connection.responseCode == 200) {
                    val response = connection.inputStream.bufferedReader().readText()
                    val json = JSONObject(response)

                    if (json.has(templateKeyToUse)) {
                        val template = json.getJSONObject(templateKeyToUse)
                        val prompts = template.getJSONArray("prompts")

                        // Find the first required string field, or default to "title"
                        for (i in 0 until prompts.length()) {
                            val prompt = prompts.getJSONObject(i)
                            if (prompt.getString("type") == "string" && prompt.getBoolean("required")) {
                                return prompt.getString("name")
                            }
                        }

                        // Fallback to first field or "title"
                        return if (prompts.length() > 0) {
                            prompts.getJSONObject(0).getString("name")
                        } else {
                            "title"
                        }
                    }
                }
                return null
            } finally {
                connection.disconnect()
            }
        } catch (e: Exception) {
            return null
        }
    }

    data class CaptureResult(val success: Boolean, val error: String? = null)
}
