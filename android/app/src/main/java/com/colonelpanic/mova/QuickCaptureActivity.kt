package com.colonelpanic.mova

import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.PopupMenu
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray

class QuickCaptureActivity : AppCompatActivity() {

    private lateinit var editText: EditText
    private lateinit var submitButton: Button
    private lateinit var micButton: ImageButton
    private lateinit var progressBar: ProgressBar
    private lateinit var titleText: TextView

    private var templateKey: String = QUICK_CAPTURE_KEY
    private var templateName: String = QUICK_CAPTURE_NAME

    /** Launches without a widget or explicit template reopen on the last pick. */
    private var rememberSelection = false
    private var templates: List<Pair<String, String>> = emptyList()

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

        val prefs = MovaSharedPrefs.get(this)
        val widgetId = intent?.data?.getQueryParameter("widgetId")?.toIntOrNull()

        if (widgetId != null) {
            templateKey = prefs.getString("widget_${widgetId}_template_key", QUICK_CAPTURE_KEY) ?: QUICK_CAPTURE_KEY
            templateName = prefs.getString("widget_${widgetId}_template_name", QUICK_CAPTURE_NAME) ?: QUICK_CAPTURE_NAME
        } else {
            rememberSelection = true
            templateKey = prefs.getString(PREF_LAST_TEMPLATE_KEY, null) ?: QUICK_CAPTURE_KEY
            templateName = prefs.getString(PREF_LAST_TEMPLATE_NAME, null) ?: QUICK_CAPTURE_NAME
        }

        // An explicit template on the link (mova://capture?template=) wins over the widget's
        val requestedTemplate = intent?.data?.getQueryParameter("template")?.trim()
        if (!requestedTemplate.isNullOrEmpty()) {
            rememberSelection = false
            templateKey = requestedTemplate
            templateName = requestedTemplate
        }

        templates = loadCachedTemplates()
        showTemplate()
        titleText.setOnClickListener { showTemplateMenu() }
        refreshTemplates()

        // Focus the edit text and show keyboard, adjusting window to stay above keyboard
        editText.requestFocus()
        window.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE or
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN
        )

        // Prefill from App Actions (Google Assistant) or mova://capture?title=
        val prefill = intent?.getStringExtra("text")?.takeIf { it.isNotBlank() }
            ?: intent?.data?.getQueryParameter("title")?.takeIf { it.isNotBlank() }
        if (prefill != null) {
            editText.setText(prefill)
            editText.setSelection(prefill.length)
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

    private fun showTemplate() {
        titleText.text = templateName
        titleText.contentDescription = getString(R.string.capture_template_description, templateName)
    }

    private fun showTemplateMenu() {
        val menu = PopupMenu(this, titleText)
        val options = listOf(QUICK_CAPTURE_KEY to QUICK_CAPTURE_NAME) + templates
        options.forEachIndexed { index, (key, name) ->
            menu.menu.add(0, index, index, name).isChecked = key == templateKey
        }
        menu.menu.setGroupCheckable(0, true, true)
        if (templates.isEmpty()) {
            menu.menu.add(1, Int.MAX_VALUE, Int.MAX_VALUE, R.string.capture_templates_loading).isEnabled = false
            refreshTemplates()
        }
        menu.setOnMenuItemClickListener { item ->
            val (key, name) = options.getOrNull(item.itemId) ?: return@setOnMenuItemClickListener false
            selectTemplate(key, name)
            true
        }
        menu.show()
    }

    private fun selectTemplate(key: String, name: String) {
        templateKey = key
        templateName = name
        showTemplate()
        if (rememberSelection) {
            MovaSharedPrefs.get(this).edit()
                .putString(PREF_LAST_TEMPLATE_KEY, key)
                .putString(PREF_LAST_TEMPLATE_NAME, name)
                .apply()
        }
    }

    private fun loadCachedTemplates(): List<Pair<String, String>> {
        val raw = MovaSharedPrefs.get(this).getString(PREF_TEMPLATES, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).map { i ->
                val entry = array.getJSONArray(i)
                entry.getString(0) to entry.getString(1)
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun refreshTemplates() {
        val appContext = applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            val client = MovaClient.fromPrefs(appContext) ?: return@launch
            val result = client.getTemplates() as? ApiResult.Ok ?: return@launch
            val fresh = result.value.values.map { it.key to it.name }
            val json = JSONArray(fresh.map { (key, name) -> JSONArray(listOf(key, name)) })
            MovaSharedPrefs.get(appContext).edit().putString(PREF_TEMPLATES, json.toString()).apply()
            withContext(Dispatchers.Main) {
                templates = fresh
                fresh.firstOrNull { it.first == templateKey }?.let { (_, name) ->
                    if (name != templateName) {
                        templateName = name
                        showTemplate()
                    }
                }
            }
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

    companion object {
        private const val QUICK_CAPTURE_KEY = "__quick_capture__"
        private const val QUICK_CAPTURE_NAME = "Quick Capture"
        private const val PREF_LAST_TEMPLATE_KEY = "quick_capture_template_key"
        private const val PREF_LAST_TEMPLATE_NAME = "quick_capture_template_name"
        private const val PREF_TEMPLATES = "quick_capture_templates"
    }
}
