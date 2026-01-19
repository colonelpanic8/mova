package com.anonymous.mova

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private const val TAG = "TemplateConfigActivity"

class TemplateConfigActivity : AppCompatActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private lateinit var radioGroup: RadioGroup
    private lateinit var progressBar: ProgressBar
    private lateinit var saveButton: Button
    private lateinit var errorText: TextView

    private val templates = mutableListOf<TemplateInfo>()

    data class TemplateInfo(val key: String, val name: String)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_template_config)

        // Set result to canceled in case the user backs out
        setResult(RESULT_CANCELED)

        // Get the widget ID from the intent
        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        radioGroup = findViewById(R.id.template_radio_group)
        progressBar = findViewById(R.id.config_progress)
        saveButton = findViewById(R.id.config_save_button)
        errorText = findViewById(R.id.config_error_text)

        saveButton.setOnClickListener {
            saveConfiguration()
        }

        loadTemplates()
    }

    private fun loadTemplates() {
        Log.d(TAG, "loadTemplates: Starting...")
        progressBar.visibility = View.VISIBLE
        errorText.visibility = View.GONE
        radioGroup.visibility = View.GONE
        saveButton.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            val result = fetchTemplates()
            Log.d(TAG, "loadTemplates: Got result - success=${result.success}, error=${result.error}, templateCount=${result.templates?.size}")

            withContext(Dispatchers.Main) {
                progressBar.visibility = View.GONE

                if (result.success && result.templates != null) {
                    templates.clear()
                    // Add Quick Capture as first option
                    templates.add(TemplateInfo("__quick_capture__", "Quick Capture"))
                    templates.addAll(result.templates)
                    Log.d(TAG, "loadTemplates: Total templates: ${templates.size}")

                    populateRadioButtons()
                    radioGroup.visibility = View.VISIBLE
                    saveButton.isEnabled = true
                } else {
                    val errorMsg = result.error ?: "Failed to load templates"
                    Log.e(TAG, "loadTemplates: Error - $errorMsg")
                    errorText.text = errorMsg
                    errorText.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun populateRadioButtons() {
        radioGroup.removeAllViews()

        templates.forEachIndexed { index, template ->
            val radioButton = RadioButton(this).apply {
                id = View.generateViewId()
                text = template.name
                textSize = 16f
                setTextColor(0xFF1C1B1F.toInt())  // Dark text color
                setPadding(24, 24, 24, 24)
                buttonTintList = android.content.res.ColorStateList.valueOf(0xFF6750A4.toInt())  // Purple tint
            }
            radioGroup.addView(radioButton)

            // Select first option by default
            if (index == 0) {
                radioButton.isChecked = true
            }
        }
    }

    private fun saveConfiguration() {
        val selectedIndex = radioGroup.indexOfChild(
            findViewById(radioGroup.checkedRadioButtonId)
        )

        if (selectedIndex < 0 || selectedIndex >= templates.size) {
            Toast.makeText(this, "Please select a template", Toast.LENGTH_SHORT).show()
            return
        }

        val selectedTemplate = templates[selectedIndex]

        // Save the selected template for this widget
        val prefs = getSharedPreferences("mova_widget_prefs", MODE_PRIVATE)
        prefs.edit()
            .putString("widget_${appWidgetId}_template_key", selectedTemplate.key)
            .putString("widget_${appWidgetId}_template_name", selectedTemplate.name)
            .apply()

        // Trigger widget update
        val updateIntent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(appWidgetId))
            component = android.content.ComponentName(this@TemplateConfigActivity,
                com.anonymous.mova.widget.QuickCaptureWidget::class.java)
        }
        sendBroadcast(updateIntent)

        // Return success
        val resultValue = Intent().apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        setResult(RESULT_OK, resultValue)
        finish()
    }

    private fun fetchTemplates(): TemplatesResult {
        try {
            Log.d(TAG, "fetchTemplates: Reading credentials from SharedPreferences...")
            val prefs = getSharedPreferences("mova_widget_prefs", MODE_PRIVATE)
            val apiUrl = prefs.getString("mova_api_url", null)
            val username = prefs.getString("mova_username", null)
            val password = prefs.getString("mova_password", null)

            Log.d(TAG, "fetchTemplates: apiUrl=${apiUrl?.take(20)}, username=$username, hasPassword=${password != null}")

            if (apiUrl == null || username == null || password == null) {
                Log.e(TAG, "fetchTemplates: Missing credentials")
                return TemplatesResult(false, error = "Please log in to the Mova app first")
            }

            val url = URL("$apiUrl/capture-templates")
            val connection = url.openConnection() as HttpURLConnection

            try {
                connection.requestMethod = "GET"
                val credentials = "$username:$password"
                val basicAuth = "Basic " + Base64.encodeToString(credentials.toByteArray(), Base64.NO_WRAP)
                connection.setRequestProperty("Authorization", basicAuth)

                val responseCode = connection.responseCode

                if (responseCode == 200) {
                    val response = connection.inputStream.bufferedReader().readText()
                    val json = JSONObject(response)

                    val templateList = mutableListOf<TemplateInfo>()
                    json.keys().forEach { key ->
                        val template = json.getJSONObject(key)
                        val name = template.getString("name")

                        // Only include single-field templates (those with at most 1 required field)
                        val prompts = template.getJSONArray("prompts")
                        var requiredCount = 0
                        for (i in 0 until prompts.length()) {
                            val prompt = prompts.getJSONObject(i)
                            if (prompt.getBoolean("required")) {
                                requiredCount++
                            }
                        }

                        if (requiredCount <= 1) {
                            templateList.add(TemplateInfo(key, name))
                        }
                    }

                    return TemplatesResult(true, templates = templateList)
                } else if (responseCode == 401) {
                    return TemplatesResult(false, error = "Authentication failed")
                } else {
                    return TemplatesResult(false, error = "Server error: $responseCode")
                }
            } finally {
                connection.disconnect()
            }
        } catch (e: Exception) {
            return TemplatesResult(false, error = "Network error: ${e.message}")
        }
    }

    data class TemplatesResult(
        val success: Boolean,
        val templates: List<TemplateInfo>? = null,
        val error: String? = null
    )
}
