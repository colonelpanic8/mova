package com.colonelpanic.mova.wear

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.text.InputType
import android.text.format.DateUtils
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.wear.tiles.TileService
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable

class MainActivity : Activity(), DataClient.OnDataChangedListener {
  private lateinit var titleInput: EditText
  private lateinit var micButton: ImageButton
  private lateinit var sendButton: ImageButton
  private lateinit var agendaChip: LinearLayout
  private lateinit var syncChip: LinearLayout
  private lateinit var syncChipLabel: TextView
  private lateinit var statusText: TextView
  private lateinit var pendingSection: LinearLayout
  private lateinit var pendingHeading: TextView
  private lateinit var pendingList: LinearLayout
  private lateinit var customViewHeading: TextView
  private lateinit var customViewList: LinearLayout
  private var customViewRequestId = 0

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(buildContentView())

    agendaChip.setOnClickListener {
      startActivity(Intent(this, AgendaActivity::class.java))
    }
    micButton.setOnClickListener {
      launchVoiceCapture()
    }
    sendButton.setOnClickListener {
      submitCurrentText()
    }
    syncChip.setOnClickListener {
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
    Wearable.getDataClient(this).addListener(this)
    refreshStatus()
    refreshCustomView()
    syncConfigFromDataLayer()
  }

  override fun onPause() {
    Wearable.getDataClient(this).removeListener(this)
    super.onPause()
  }

  private fun buildContentView(): ScrollView {
    val metrics = resources.displayMetrics
    // Round-screen insets scale with the display so content clears the bezel.
    val horizontalInset = (metrics.widthPixels * 0.10f).toInt()
    val topInset = (metrics.heightPixels * 0.12f).toInt()
    val bottomInset = (metrics.heightPixels * 0.14f).toInt()

    val root = ScrollView(this).apply {
      setBackgroundColor(getColor(R.color.background))
      isFillViewport = true
    }

    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(horizontalInset, topInset, horizontalInset, bottomInset)
    }

    val heading = TextView(this).apply {
      text = "Mova"
      textSize = 16f
      setTextColor(getColor(R.color.text_primary))
      gravity = Gravity.CENTER
    }

    statusText = TextView(this).apply {
      textSize = 11f
      setTextColor(getColor(R.color.text_secondary))
      gravity = Gravity.CENTER
      setPadding(0, dp(4), 0, dp(12))
    }

    agendaChip = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      background = getDrawable(R.drawable.bg_chip)
      setPadding(dp(14), dp(6), dp(16), dp(6))
      isClickable = true
      contentDescription = "Open today's agenda"
    }
    agendaChip.addView(
      ImageView(this).apply {
        setImageResource(R.drawable.ic_list)
        // ic_list is tinted dark for the teal tile edge button; on the dark
        // chip it needs the light secondary tint instead.
        setColorFilter(getColor(R.color.text_secondary))
      },
      LinearLayout.LayoutParams(dp(16), dp(16)),
    )
    agendaChip.addView(
      TextView(this).apply {
        text = "Today's agenda"
        textSize = 12f
        isAllCaps = false
        setTextColor(getColor(R.color.text_secondary))
      },
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply { marginStart = dp(6) },
    )

    micButton = ImageButton(this).apply {
      background = getDrawable(R.drawable.bg_icon_primary)
      setImageResource(R.drawable.ic_mic)
      scaleType = ImageView.ScaleType.CENTER_INSIDE
      stateListAnimator = null
      contentDescription = getString(R.string.mic_button_description)
    }

    val inputRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      background = getDrawable(R.drawable.bg_input)
    }

    titleInput = EditText(this).apply {
      hint = "Add a todo"
      setSingleLine(true)
      inputType = InputType.TYPE_CLASS_TEXT or
        InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
      imeOptions = EditorInfo.IME_ACTION_SEND
      setTextColor(getColor(R.color.text_primary))
      setHintTextColor(getColor(R.color.text_secondary))
      textSize = 14f
      background = null
      setPadding(dp(16), 0, dp(8), 0)
    }

    sendButton = ImageButton(this).apply {
      background = getDrawable(R.drawable.bg_icon_primary)
      setImageResource(R.drawable.ic_send)
      scaleType = ImageView.ScaleType.CENTER_INSIDE
      stateListAnimator = null
      contentDescription = getString(R.string.send_button_description)
    }

    inputRow.addView(
      titleInput,
      LinearLayout.LayoutParams(0, dp(36), 1f),
    )
    inputRow.addView(
      sendButton,
      LinearLayout.LayoutParams(dp(34), dp(34)).apply {
        marginEnd = dp(4)
      },
    )

    syncChip = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      background = getDrawable(R.drawable.bg_chip)
      setPadding(dp(14), dp(6), dp(16), dp(6))
      isClickable = true
      visibility = View.GONE
    }
    val syncChipIcon = ImageView(this).apply {
      setImageResource(R.drawable.ic_sync)
    }
    syncChipLabel = TextView(this).apply {
      textSize = 12f
      isAllCaps = false
      setTextColor(getColor(R.color.text_secondary))
    }
    syncChip.addView(syncChipIcon, LinearLayout.LayoutParams(dp(16), dp(16)))
    syncChip.addView(
      syncChipLabel,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply { marginStart = dp(6) },
    )

    pendingHeading = sectionHeading("Pending")
    pendingList = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
    }
    pendingSection = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      visibility = View.GONE
    }
    pendingSection.addView(pendingHeading, matchWrap())
    pendingSection.addView(pendingList, matchWrap())

    customViewHeading = sectionHeading("Watch view")
    customViewList = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
    }

    content.addView(heading, matchWrap())
    content.addView(statusText, matchWrap())
    content.addView(
      agendaChip,
      wrap(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
        bottomMargin = dp(12),
      ),
    )
    content.addView(micButton, wrap(dp(56), dp(56)))
    content.addView(inputRow, matchWrap(topMargin = dp(12), fixedHeight = dp(44)))
    content.addView(
      syncChip,
      wrap(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
        topMargin = dp(10),
      ),
    )
    content.addView(pendingSection, matchWrap(topMargin = dp(16)))
    content.addView(customViewHeading, matchWrap(topMargin = dp(14)))
    content.addView(customViewList, matchWrap(bottomMargin = dp(4)))
    root.addView(content)
    return root
  }

  private fun launchVoiceCapture() {
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(
        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
      )
      putExtra(RecognizerIntent.EXTRA_PROMPT, getString(R.string.voice_prompt))
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
      refreshCustomView()
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
        refreshCustomView()
      }
    }.start()
  }

  private fun refreshStatus(prefix: String? = null) {
    TileService.getUpdater(this).requestUpdate(QuickCaptureTileService::class.java)
    val configured = MovaWearStorage.getCredentials(this) != null
    val pendingCount = MovaWearStorage.getPendingTodos(this).size
    val configText = if (configured) "Ready" else "Needs phone sync"
    val queueText = if (pendingCount > 0) " · $pendingCount queued" else ""
    setStatus(listOfNotNull(prefix, "$configText$queueText").joinToString("\n"))

    if (configured && pendingCount > 0) {
      syncChipLabel.text = "Sync $pendingCount queued"
      syncChip.visibility = View.VISIBLE
    } else {
      syncChip.visibility = View.GONE
    }

    refreshPendingList(pendingCount)
  }

  private fun refreshPendingList(pendingCount: Int) {
    if (pendingCount == 0) {
      pendingSection.visibility = View.GONE
      pendingList.removeAllViews()
      return
    }

    val pending = MovaWearStorage.getPendingTodos(this)
    pendingSection.visibility = View.VISIBLE
    pendingHeading.text = "Pending · ${pending.size}"
    populateActivityList(
      pendingList,
      pending.asReversed().take(MAX_VISIBLE_ACTIVITY_ITEMS).map {
        ActivityItem(
          text = it.text,
          detail = "Queued ${relativeTime(it.timestamp)}",
          label = "Queued",
        )
      },
      "",
    )
  }

  private fun refreshCustomView() {
    val requestId = ++customViewRequestId
    val credentials = MovaWearStorage.getCredentials(this)
    val selectedView = MovaWearStorage.getCustomView(this)

    if (selectedView == null) {
      customViewHeading.text = "Watch view"
      populateActivityList(
        customViewList,
        emptyList(),
        "Choose a custom view in Mova settings",
      )
      return
    }

    customViewHeading.text = selectedView.name
    if (credentials == null) {
      populateActivityList(
        customViewList,
        emptyList(),
        "Open Mova on your phone to sync",
      )
      return
    }

    populateActivityList(customViewList, emptyList(), "Loading…")
    Thread {
      val result = CaptureClient.getCustomView(credentials, selectedView)
      runOnUiThread {
        val currentView = MovaWearStorage.getCustomView(this)
        if (requestId != customViewRequestId || currentView?.key != selectedView.key) {
          return@runOnUiThread
        }

        customViewHeading.text = result.name ?: selectedView.name
        if (result.success) {
          populateActivityList(
            customViewList,
            result.entries.take(MAX_VISIBLE_ACTIVITY_ITEMS).map { entry ->
              ActivityItem(
                text = entry.title,
                detail = entry.detail,
                label = "View item",
              )
            },
            "No items",
          )
        } else {
          populateActivityList(customViewList, emptyList(), result.message)
        }
      }
    }.start()
  }

  private fun populateActivityList(
    container: LinearLayout,
    items: List<ActivityItem>,
    emptyText: String,
  ) {
    container.removeAllViews()
    if (items.isEmpty()) {
      if (emptyText.isBlank()) {
        return
      }
      container.addView(
        TextView(this).apply {
          text = emptyText
          textSize = 12f
          setTextColor(getColor(R.color.text_secondary))
          gravity = Gravity.CENTER
          setPadding(dp(8), dp(7), dp(8), dp(7))
        },
        matchWrap(),
      )
      return
    }

    items.forEach { item ->
      val row = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = getDrawable(R.drawable.bg_card)
        setPadding(dp(12), dp(10), dp(12), dp(10))
        contentDescription = "${item.label}: ${item.text}"
      }
      row.addView(
        TextView(this).apply {
          text = item.text
          textSize = 13f
          setTextColor(getColor(R.color.text_primary))
          maxLines = 2
        },
        matchWrap(),
      )
      if (item.detail.isNotBlank()) {
        row.addView(
          TextView(this).apply {
            text = item.detail
            textSize = 10f
            setTextColor(getColor(R.color.text_secondary))
          },
          matchWrap(topMargin = dp(2)),
        )
      }
      container.addView(row, matchWrap(bottomMargin = dp(6)))
    }
  }

  private fun relativeTime(timestamp: Long): CharSequence =
    DateUtils.getRelativeTimeSpanString(
      timestamp,
      System.currentTimeMillis(),
      DateUtils.MINUTE_IN_MILLIS,
      DateUtils.FORMAT_ABBREV_RELATIVE,
    )

  private fun sectionHeading(label: String): TextView =
    TextView(this).apply {
      text = label
      textSize = 12f
      setTextColor(getColor(R.color.primary))
      gravity = Gravity.START
      setPadding(dp(4), 0, dp(4), dp(6))
    }

  private fun syncConfigFromDataLayer() {
    Wearable.getDataClient(this).dataItems
      .addOnSuccessListener { dataItems ->
        var configFound = false
        try {
          dataItems
            .filter { item -> item.uri.path == CONFIG_PATH }
            .forEach { item ->
              val dataMap = DataMapItem.fromDataItem(item).dataMap
              configFound = applyConfig(dataMap) || configFound
            }
        } finally {
          dataItems.release()
        }
        if (configFound) {
          handleConfigUpdated()
        }
      }
  }

  override fun onDataChanged(dataEvents: DataEventBuffer) {
    var configChanged = false
    try {
      dataEvents
        .filter { event ->
          event.type == DataEvent.TYPE_CHANGED &&
            event.dataItem.uri.path == CONFIG_PATH
        }
        .forEach { event ->
          configChanged =
            applyConfig(DataMapItem.fromDataItem(event.dataItem).dataMap) ||
            configChanged
        }
    } finally {
      dataEvents.release()
    }

    if (configChanged) {
      runOnUiThread {
        handleConfigUpdated()
      }
    }
  }

  private fun applyConfig(dataMap: DataMap): Boolean {
    if (!dataMap.getBoolean("configured", false)) {
      MovaWearStorage.clearCredentials(this)
      return true
    }

    val apiUrl = dataMap.getString("apiUrl")
    val username = dataMap.getString("username")
    val password = dataMap.getString("password")
    if (apiUrl.isNullOrBlank() || username.isNullOrBlank() || password == null) {
      return false
    }

    MovaWearStorage.saveCredentials(
      this,
      apiUrl,
      username,
      password,
      dataMap.getString("customViewKey"),
      dataMap.getString("customViewName"),
    )
    return true
  }

  private fun handleConfigUpdated() {
    if (
      MovaWearStorage.getCredentials(this) != null &&
      MovaWearStorage.getPendingTodos(this).isNotEmpty()
    ) {
      processPendingTodos()
    } else {
      refreshStatus()
      refreshCustomView()
    }
  }

  private fun setBusy(isBusy: Boolean, status: String? = null) {
    val alpha = if (isBusy) 0.5f else 1f
    for (control in listOf(titleInput, micButton, sendButton, syncChip)) {
      control.isEnabled = !isBusy
      control.alpha = alpha
    }
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
    fixedHeight: Int = LinearLayout.LayoutParams.WRAP_CONTENT,
  ): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      fixedHeight,
    ).apply {
      this.topMargin = topMargin
      this.bottomMargin = bottomMargin
    }

  private fun wrap(
    width: Int,
    height: Int,
    topMargin: Int = 0,
    bottomMargin: Int = 0,
  ): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(width, height).apply {
      this.topMargin = topMargin
      this.bottomMargin = bottomMargin
    }

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()

  private companion object {
    const val VOICE_CAPTURE_REQUEST = 1001
    const val MAX_VISIBLE_ACTIVITY_ITEMS = 5
  }

  private data class ActivityItem(
    val text: String,
    val detail: String,
    val label: String,
  )
}
