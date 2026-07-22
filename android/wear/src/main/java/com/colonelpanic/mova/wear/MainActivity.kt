package com.colonelpanic.mova.wear

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.text.InputType
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable

open class MainActivity : Activity() {
  private lateinit var titleInput: EditText
  private lateinit var voiceButton: Button
  private lateinit var submitButton: Button
  private lateinit var retryButton: Button
  private lateinit var statusText: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(buildContentView())

    voiceButton.setOnClickListener {
      launchVoiceCapture()
    }
    submitButton.setOnClickListener {
      submitCurrentText()
    }
    retryButton.setOnClickListener {
      processPendingTodos()
    }
    titleInput.setOnEditorActionListener { _, actionId, _ ->
      if (actionId == EditorInfo.IME_ACTION_SEND || actionId == EditorInfo.IME_ACTION_DONE) {
        submitCurrentText()
        true
      } else {
        false
      }
    }
  }

  override fun onResume() {
    super.onResume()
    refreshStatus()
    syncConfigFromDataLayer()
  }

  private fun buildContentView(): ScrollView {
    val padding = dp(18)
    val root = ScrollView(this).apply {
      setBackgroundColor(getColor(R.color.background))
      isFillViewport = true
    }

    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(padding, padding, padding, padding)
    }

    val heading = TextView(this).apply {
      text = "Mova"
      textSize = 20f
      setTextColor(getColor(R.color.text_primary))
      gravity = Gravity.CENTER
    }

    statusText = TextView(this).apply {
      textSize = 12f
      setTextColor(getColor(R.color.text_secondary))
      gravity = Gravity.CENTER
      setPadding(0, dp(6), 0, dp(10))
    }

    titleInput = EditText(this).apply {
      hint = "Todo"
      setSingleLine(true)
      inputType = InputType.TYPE_CLASS_TEXT or
        InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
      imeOptions = EditorInfo.IME_ACTION_SEND
      setTextColor(getColor(R.color.text_primary))
      setHintTextColor(getColor(R.color.text_secondary))
      setBackgroundColor(getColor(R.color.surface))
      setPadding(dp(12), 0, dp(12), 0)
    }

    voiceButton = Button(this).apply {
      text = "Voice capture"
      textSize = 18f
      minHeight = dp(72)
    }

    submitButton = Button(this).apply {
      text = "Capture"
      minHeight = dp(44)
    }

    retryButton = Button(this).apply {
      text = "Retry queued"
      minHeight = dp(40)
    }

    content.addView(heading, matchWrap())
    content.addView(statusText, matchWrap())
    content.addView(voiceButton, matchWrap(bottomMargin = dp(8)))
    content.addView(titleInput, matchFixedHeight(48))
    content.addView(submitButton, matchWrap(topMargin = dp(8)))
    content.addView(retryButton, matchWrap(topMargin = dp(4)))
    root.addView(content)
    return root
  }

  protected fun launchVoiceCapture() {
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(
        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
      )
      putExtra(RecognizerIntent.EXTRA_PROMPT, "What should Mova capture?")
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }

    try {
      startActivityForResult(intent, VOICE_CAPTURE_REQUEST)
    } catch (_: ActivityNotFoundException) {
      setStatus("Voice input isn't available on this watch")
    }
  }

  @Deprecated("Uses the system speech recognizer activity for broad Wear OS support")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != VOICE_CAPTURE_REQUEST || resultCode != RESULT_OK) {
      return
    }

    val spokenText =
      data
        ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
        ?.firstOrNull()
        ?.trim()

    if (spokenText.isNullOrBlank()) {
      setStatus("Didn't hear a todo")
      return
    }

    titleInput.setText(spokenText)
    titleInput.setSelection(spokenText.length)
    submitCurrentText()
  }

  private fun submitCurrentText() {
    val text = titleInput.text.toString().trim()
    if (text.isBlank()) {
      setStatus("Enter a todo")
      return
    }

    val credentials = MovaWearStorage.getCredentials(this)
    if (credentials == null) {
      MovaWearStorage.queueTodo(this, text)
      titleInput.text.clear()
      refreshStatus("Queued until phone syncs Mova settings")
      return
    }

    setBusy(true, "Capturing...")
    Thread {
      val result = CaptureClient.capture(credentials, text)
      runOnUiThread {
        setBusy(false)
        if (result.success) {
          titleInput.text.clear()
          processPendingTodos("Captured")
        } else {
          MovaWearStorage.queueTodo(this, text)
          titleInput.text.clear()
          refreshStatus("${result.message}; queued")
        }
      }
    }.start()
  }

  private fun processPendingTodos(successPrefix: String? = null) {
    val credentials = MovaWearStorage.getCredentials(this)
    if (credentials == null) {
      refreshStatus("Open Mova on phone to sync settings")
      return
    }

    val pending = MovaWearStorage.getPendingTodos(this)
    if (pending.isEmpty()) {
      refreshStatus(successPrefix)
      return
    }

    setBusy(true, "Retrying ${pending.size} queued")
    Thread {
      var captured = 0
      for (todo in pending) {
        val result = CaptureClient.capture(credentials, todo.text)
        if (result.success) {
          MovaWearStorage.removePendingTodo(this, todo.timestamp)
          captured += 1
        } else {
          runOnUiThread {
            setBusy(false)
            refreshStatus("Retried $captured; ${result.message}")
          }
          return@Thread
        }
      }

      runOnUiThread {
        setBusy(false)
        refreshStatus(
          when {
            successPrefix != null && captured > 0 -> "$successPrefix; synced $captured queued"
            successPrefix != null -> successPrefix
            else -> "Synced $captured queued"
          },
        )
      }
    }.start()
  }

  private fun refreshStatus(prefix: String? = null) {
    val configured = MovaWearStorage.getCredentials(this) != null
    val pendingCount = MovaWearStorage.getPendingTodos(this).size
    val configText = if (configured) "Ready" else "Needs phone sync"
    val queueText = if (pendingCount > 0) " · $pendingCount queued" else ""
    setStatus(listOfNotNull(prefix, "$configText$queueText").joinToString("\n"))
  }

  private fun syncConfigFromDataLayer() {
    Wearable.getDataClient(this).dataItems
      .addOnSuccessListener { dataItems ->
        try {
          dataItems
            .filter { item -> item.uri.path == CONFIG_PATH }
            .forEach { item ->
              val dataMap = DataMapItem.fromDataItem(item).dataMap
              val configured = dataMap.getBoolean("configured", false)

              if (!configured) {
                MovaWearStorage.clearCredentials(this)
                return@forEach
              }

              val apiUrl = dataMap.getString("apiUrl")
              val username = dataMap.getString("username")
              val password = dataMap.getString("password")

              if (!apiUrl.isNullOrBlank() && !username.isNullOrBlank() && password != null) {
                MovaWearStorage.saveCredentials(this, apiUrl, username, password)
              }
            }
        } finally {
          dataItems.release()
        }
        if (
          MovaWearStorage.getCredentials(this) != null &&
          MovaWearStorage.getPendingTodos(this).isNotEmpty()
        ) {
          processPendingTodos()
        } else {
          refreshStatus()
        }
      }
  }

  private fun setBusy(isBusy: Boolean, status: String? = null) {
    titleInput.isEnabled = !isBusy
    voiceButton.isEnabled = !isBusy
    submitButton.isEnabled = !isBusy
    retryButton.isEnabled = !isBusy
    if (status != null) {
      setStatus(status)
    }
  }

  private fun setStatus(status: String) {
    statusText.text = status
  }

  private fun matchWrap(
    topMargin: Int = 0,
    bottomMargin: Int = 0,
  ): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      this.topMargin = topMargin
      this.bottomMargin = bottomMargin
    }

  private fun matchFixedHeight(height: Int): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      height,
    )

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()

  private companion object {
    const val VOICE_CAPTURE_REQUEST = 1001
  }
}
