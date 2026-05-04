package com.colonelpanic.mova.wear

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable

class MainActivity : Activity() {
  private lateinit var titleInput: EditText
  private lateinit var submitButton: Button
  private lateinit var retryButton: Button
  private lateinit var statusText: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(buildContentView())

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
    titleInput.requestFocus()
    titleInput.postDelayed({
      val inputMethodManager =
        getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
      inputMethodManager.showSoftInput(titleInput, InputMethodManager.SHOW_IMPLICIT)
    }, 250)
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
    content.addView(titleInput, matchFixedHeight(48))
    content.addView(submitButton, matchWrap(topMargin = dp(8)))
    content.addView(retryButton, matchWrap(topMargin = dp(4)))
    root.addView(content)
    return root
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
    submitButton.isEnabled = !isBusy
    retryButton.isEnabled = !isBusy
    if (status != null) {
      setStatus(status)
    }
  }

  private fun setStatus(status: String) {
    statusText.text = status
  }

  private fun matchWrap(topMargin: Int = 0): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      this.topMargin = topMargin
    }

  private fun matchFixedHeight(height: Int): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      height,
    )

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()
}
