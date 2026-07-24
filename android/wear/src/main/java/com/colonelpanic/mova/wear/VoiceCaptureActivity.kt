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
import android.widget.TextView
import androidx.wear.tiles.TileService

/**
 * Minimal, standalone "capture and get out" surface. Immediately launches the
 * system speech recognizer, submits (or queues) the spoken todo, shows a brief
 * outcome, then finishes. Unlike the main app it never shows the scrolling
 * dashboard behind the recognizer dialog.
 */
class VoiceCaptureActivity : Activity() {
  private lateinit var statusCircle: ImageView
  private lateinit var statusTitle: TextView
  private lateinit var statusDetail: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(buildContentView())
    showCapturing()
    if (savedInstanceState == null) {
      window.decorView.post { launchRecognizer() }
    }
  }

  private fun buildContentView(): LinearLayout {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(getColor(R.color.background))
      setPadding(dp(24), dp(24), dp(24), dp(24))
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
      maxLines = 2
      visibility = View.GONE
    }

    root.addView(
      statusCircle,
      LinearLayout.LayoutParams(dp(72), dp(72)),
    )
    root.addView(
      statusTitle,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply { topMargin = dp(12) },
    )
    root.addView(
      statusDetail,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply { topMargin = dp(4) },
    )
    return root
  }

  private fun launchRecognizer() {
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
      finish()
    }
  }

  @Deprecated("Uses the system speech recognizer activity for broad Wear OS support")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != VOICE_CAPTURE_REQUEST || resultCode != RESULT_OK) {
      finish()
      return
    }

    val spokenText =
      data
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
    val credentials = MovaWearStorage.getCredentials(this)
    if (credentials == null) {
      MovaWearStorage.queueTodo(this, text)
      requestTileUpdate()
      showQueued()
      finishAfter(QUEUED_DISMISS_MS)
      return
    }

    Thread {
      val result = CaptureClient.capture(credentials, text)
      if (result.success) {
        flushPending(credentials)
      }
      runOnUiThread {
        requestTileUpdate()
        if (result.success) {
          showSuccess(text)
          finishAfter(SUCCESS_DISMISS_MS)
        } else {
          MovaWearStorage.queueTodo(this, text)
          showQueued()
          finishAfter(QUEUED_DISMISS_MS)
        }
      }
    }.start()
  }

  /**
   * Opportunistically drains the pending queue while the connection is warm.
   * Mirrors [MainActivity]'s retry loop: stop on the first failure so we never
   * drop a todo.
   */
  private fun flushPending(credentials: WearCredentials) {
    for (todo in MovaWearStorage.getPendingTodos(this)) {
      val result = CaptureClient.capture(credentials, todo.text)
      if (result.success) {
        MovaWearStorage.removePendingTodo(this, todo.timestamp)
      } else {
        return
      }
    }
  }

  private fun showCapturing() {
    setState(
      circle = R.drawable.circle_surface,
      icon = R.drawable.ic_mic,
      iconColor = R.color.text_primary,
      title = getString(R.string.capturing),
      detail = null,
    )
  }

  private fun showSuccess(text: String) {
    setState(
      circle = R.drawable.circle_primary,
      icon = R.drawable.ic_check,
      iconColor = R.color.on_primary,
      title = getString(R.string.captured),
      detail = text,
    )
  }

  private fun showQueued() {
    setState(
      circle = R.drawable.circle_surface,
      icon = R.drawable.ic_sync,
      iconColor = R.color.text_secondary,
      title = getString(R.string.queued_offline),
      detail = null,
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

  private fun requestTileUpdate() {
    TileService.getUpdater(this)
      .requestUpdate(QuickCaptureTileService::class.java)
  }

  private fun finishAfter(delayMs: Long) {
    window.decorView.postDelayed({
      if (!isFinishing) {
        finish()
      }
    }, delayMs)
  }

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()

  private companion object {
    const val VOICE_CAPTURE_REQUEST = 1001
    const val SUCCESS_DISMISS_MS = 1400L
    const val QUEUED_DISMISS_MS = 1600L
  }
}
