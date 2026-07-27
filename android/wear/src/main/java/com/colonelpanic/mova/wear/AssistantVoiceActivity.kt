package com.colonelpanic.mova.wear

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.wear.tiles.TileService

/**
 * Dictates one natural-language request, runs the OpenAI tool loop off the UI
 * thread, and leaves the concise result on screen until the user dismisses it.
 */
class AssistantVoiceActivity : Activity() {
  private lateinit var statusCircle: ImageView
  private lateinit var statusTitle: TextView
  private lateinit var statusDetail: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(buildContentView())
    showListening()
    if (savedInstanceState == null) {
      window.decorView.post { launchRecognizer() }
    }
  }

  private fun buildContentView(): ScrollView {
    val root = ScrollView(this).apply {
      setBackgroundColor(getColor(R.color.background))
      isFillViewport = true
    }
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(24), dp(30), dp(24), dp(30))
    }

    statusCircle = ImageView(this).apply {
      scaleType = ImageView.ScaleType.CENTER_INSIDE
    }
    statusTitle = TextView(this).apply {
      textSize = 16f
      setTextColor(getColor(R.color.text_primary))
      gravity = Gravity.CENTER
    }
    statusDetail = TextView(this).apply {
      textSize = 13f
      setTextColor(getColor(R.color.text_secondary))
      gravity = Gravity.CENTER
      visibility = View.GONE
      setTextIsSelectable(true)
    }

    content.addView(statusCircle, LinearLayout.LayoutParams(dp(64), dp(64)))
    content.addView(
      statusTitle,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply { topMargin = dp(10) },
    )
    content.addView(
      statusDetail,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply { topMargin = dp(8) },
    )
    root.addView(content)
    return root
  }

  private fun launchRecognizer() {
    if (MovaWearStorage.getOpenAiSettings(this) == null) {
      showError("Set an OpenAI API key in Mova settings on your phone")
      return
    }
    if (MovaWearStorage.getCredentials(this) == null) {
      showError("Open Mova on your phone to sync org-agenda-api settings")
      return
    }

    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(
        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
      )
      putExtra(RecognizerIntent.EXTRA_PROMPT, getString(R.string.assistant_voice_prompt))
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }

    try {
      startActivityForResult(intent, ASSISTANT_VOICE_REQUEST)
    } catch (_: ActivityNotFoundException) {
      showError("Voice input isn't available on this watch")
    }
  }

  @Deprecated("Uses the system speech recognizer activity for broad Wear OS support")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != ASSISTANT_VOICE_REQUEST || resultCode != RESULT_OK) {
      finish()
      return
    }

    val spokenText = data
      ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
      ?.firstOrNull()
      ?.trim()
    if (spokenText.isNullOrBlank()) {
      finish()
      return
    }
    submit(spokenText)
  }

  private fun submit(text: String) {
    val settings = MovaWearStorage.getOpenAiSettings(this)
    val credentials = MovaWearStorage.getCredentials(this)
    if (settings == null || credentials == null) {
      showError("Open Mova on your phone and sync assistant settings")
      return
    }

    showWorking(text)
    Thread {
      val result = OpenAiAssistantClient.run(settings, credentials, text)
      runOnUiThread {
        requestTileUpdates()
        if (result.success) {
          showResult(result.message)
        } else {
          showError(result.message)
        }
      }
    }.start()
  }

  private fun showListening() {
    setState(
      circle = R.drawable.circle_surface,
      icon = R.drawable.ic_auto_awesome,
      iconColor = R.color.text_primary,
      title = getString(R.string.assistant_listening),
      detail = null,
    )
  }

  private fun showWorking(request: String) {
    setState(
      circle = R.drawable.circle_surface,
      icon = R.drawable.ic_sync,
      iconColor = R.color.text_secondary,
      title = getString(R.string.assistant_working),
      detail = request,
    )
  }

  private fun showResult(message: String) {
    setState(
      circle = R.drawable.circle_primary,
      icon = R.drawable.ic_check,
      iconColor = R.color.on_primary,
      title = getString(R.string.assistant_result),
      detail = message,
    )
  }

  private fun showError(message: String) {
    setState(
      circle = R.drawable.circle_surface,
      icon = R.drawable.ic_auto_awesome,
      iconColor = R.color.warn,
      title = getString(R.string.assistant_error),
      detail = message,
    )
  }

  private fun setState(
    circle: Int,
    icon: Int,
    iconColor: Int,
    title: String,
    detail: String?,
  ) {
    statusCircle.background = getDrawable(circle)
    statusCircle.setImageResource(icon)
    statusCircle.setColorFilter(getColor(iconColor))
    statusTitle.text = title
    if (detail.isNullOrBlank()) {
      statusDetail.visibility = View.GONE
    } else {
      statusDetail.text = detail
      statusDetail.visibility = View.VISIBLE
    }
  }

  private fun requestTileUpdates() {
    TileService.getUpdater(this).requestUpdate(QuickCaptureTileService::class.java)
    TileService.getUpdater(this).requestUpdate(AgendaTileService::class.java)
  }

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()

  private companion object {
    const val ASSISTANT_VOICE_REQUEST = 2001
  }
}
