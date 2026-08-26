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
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject

/**
 * One-tap "don't forget" surface: preset chips arm a pin on the phone over
 * the Data Layer; the mic chip captures a freeform pin title by voice. The
 * phone owns pin state and the persistent notification.
 */
class PinArmActivity : Activity() {
  private lateinit var chooser: ScrollView
  private lateinit var statusView: LinearLayout
  private lateinit var statusCircle: ImageView
  private lateinit var statusTitle: TextView
  private lateinit var statusDetail: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val root = android.widget.FrameLayout(this).apply {
      setBackgroundColor(getColor(R.color.background))
    }
    chooser = buildChooser()
    statusView = buildStatusView()
    statusView.visibility = View.GONE
    root.addView(chooser)
    root.addView(statusView)
    setContentView(root)
  }

  private fun buildChooser(): ScrollView {
    val list = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(24), dp(32), dp(24), dp(32))
    }

    list.addView(
      TextView(this).apply {
        textSize = 15f
        setTextColor(getColor(R.color.text_primary))
        gravity = Gravity.CENTER
        text = getString(R.string.pin_title)
      },
      chipParams(topMargin = 0),
    )

    MovaWearStorage.getPinPresets(this).forEach { preset ->
      list.addView(chip(presetLabel(preset)) { sendPin(preset.title, preset.minutes) }, chipParams())
    }

    list.addView(
      chip(getString(R.string.pin_custom_voice)) { launchRecognizer() },
      chipParams(),
    )

    return ScrollView(this).apply { addView(list) }
  }

  private fun presetLabel(preset: WearPinPreset): String =
    if (preset.minutes > 0) {
      "${preset.title} · " + getString(R.string.pin_minutes_suffix, preset.minutes)
    } else {
      preset.title
    }

  private fun chip(label: String, onClick: () -> Unit): TextView =
    TextView(this).apply {
      textSize = 14f
      setTextColor(getColor(R.color.text_primary))
      gravity = Gravity.CENTER
      background = getDrawable(R.drawable.bg_chip)
      setPadding(dp(16), dp(10), dp(16), dp(10))
      text = label
      setOnClickListener { onClick() }
    }

  private fun chipParams(topMargin: Int = 8): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply { this.topMargin = dp(topMargin) }

  private fun buildStatusView(): LinearLayout {
    val view = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
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
    view.addView(statusCircle, LinearLayout.LayoutParams(dp(72), dp(72)))
    view.addView(
      statusTitle,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply { topMargin = dp(12) },
    )
    view.addView(
      statusDetail,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply { topMargin = dp(4) },
    )
    return view
  }

  private fun launchRecognizer() {
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(
        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
      )
      putExtra(RecognizerIntent.EXTRA_PROMPT, getString(R.string.pin_voice_prompt))
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }
    try {
      startActivityForResult(intent, PIN_VOICE_REQUEST)
    } catch (_: ActivityNotFoundException) {
      // No recognizer on this watch; the preset chips still work.
    }
  }

  @Deprecated("Uses the system speech recognizer activity for broad Wear OS support")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != PIN_VOICE_REQUEST || resultCode != RESULT_OK) return
    val spokenText = data
      ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
      ?.firstOrNull()
      ?.trim()
    if (!spokenText.isNullOrBlank()) {
      // -1 = use the phone's default reminder time.
      sendPin(spokenText, -1)
    }
  }

  private fun sendPin(title: String, escalateMinutes: Int) {
    showSending()
    val payload = JSONObject()
      .put("title", title)
      .put("escalateMinutes", escalateMinutes)
      .toString()
      .toByteArray(Charsets.UTF_8)

    Thread {
      val delivered = try {
        val nodes = Tasks.await(Wearable.getNodeClient(this).connectedNodes)
        val target = nodes.firstOrNull { it.isNearby } ?: nodes.firstOrNull()
        if (target == null) {
          false
        } else {
          Tasks.await(
            Wearable.getMessageClient(this).sendMessage(target.id, PIN_ARM_PATH, payload),
          )
          true
        }
      } catch (_: Exception) {
        false
      }

      runOnUiThread {
        if (delivered) {
          showResult(
            circle = R.drawable.circle_primary,
            icon = R.drawable.ic_check,
            iconColor = R.color.on_primary,
            title = getString(R.string.pin_success),
            detail = title,
          )
          finishAfter(SUCCESS_DISMISS_MS)
        } else {
          showResult(
            circle = R.drawable.circle_surface,
            icon = R.drawable.ic_sync,
            iconColor = R.color.text_secondary,
            title = getString(R.string.pin_failure),
            detail = null,
          )
          finishAfter(FAILURE_DISMISS_MS)
        }
      }
    }.start()
  }

  private fun showSending() {
    chooser.visibility = View.GONE
    statusView.visibility = View.VISIBLE
    showResult(
      circle = R.drawable.circle_surface,
      icon = R.drawable.ic_pin,
      iconColor = R.color.text_primary,
      title = getString(R.string.pin_sending),
      detail = null,
    )
  }

  private fun showResult(
    circle: Int,
    icon: Int,
    iconColor: Int,
    title: String,
    detail: String?,
  ) {
    chooser.visibility = View.GONE
    statusView.visibility = View.VISIBLE
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
    const val PIN_VOICE_REQUEST = 1002
    const val SUCCESS_DISMISS_MS = 1400L
    const val FAILURE_DISMISS_MS = 1800L
  }
}
