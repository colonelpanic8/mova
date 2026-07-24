package com.colonelpanic.mova.wear

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.wear.tiles.TileService

/**
 * Full-screen, scrollable view of today's org agenda with per-row quick
 * completion. Complements [AgendaTileService], which only has room for the
 * top few items; the tile's edge button opens this activity for the rest.
 */
class AgendaActivity : Activity() {
  private lateinit var titleText: TextView
  private lateinit var statusText: TextView
  private lateinit var list: LinearLayout
  private var requestId = 0
  private var isBusy = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(buildContentView())
  }

  override fun onResume() {
    super.onResume()
    refresh()
  }

  private fun buildContentView(): ScrollView {
    val metrics = resources.displayMetrics
    val horizontalInset = (metrics.widthPixels * 0.08f).toInt()
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

    titleText = TextView(this).apply {
      text = "Today"
      textSize = 16f
      setTextColor(getColor(R.color.text_primary))
      gravity = Gravity.CENTER
    }

    statusText = TextView(this).apply {
      textSize = 11f
      setTextColor(getColor(R.color.text_secondary))
      gravity = Gravity.CENTER
      setPadding(0, dp(3), 0, dp(10))
    }

    list = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
    }

    content.addView(titleText, matchWrap())
    content.addView(statusText, matchWrap())
    content.addView(list, matchWrap())
    root.addView(content)
    return root
  }

  private fun refresh() {
    val credentials = MovaWearStorage.getCredentials(this)
    if (credentials == null) {
      setStatus("Open Mova on your phone to sync")
      list.removeAllViews()
      return
    }

    val currentRequest = ++requestId
    setStatus("Loading…")
    list.removeAllViews()
    Thread {
      val result = AgendaClient.getAgenda(credentials)
      runOnUiThread {
        if (currentRequest != requestId) {
          return@runOnUiThread
        }
        if (result.success) {
          renderItems(result.items)
        } else {
          setStatus(result.message)
        }
      }
    }.start()
  }

  private fun renderItems(items: List<AgendaItem>) {
    list.removeAllViews()
    val outstanding = items.count { !it.completedToday }
    setStatus(
      when {
        items.isEmpty() -> "Nothing scheduled"
        outstanding == 0 -> "All clear ✓"
        outstanding == 1 -> "1 item"
        else -> "$outstanding items"
      },
    )

    items.forEach { item ->
      list.addView(buildRow(item), matchWrap(bottomMargin = dp(6)))
    }
  }

  private fun buildRow(item: AgendaItem): LinearLayout {
    val row = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      background = getDrawable(R.drawable.bg_card)
      setPadding(dp(12), dp(10), dp(10), dp(10))
    }

    val textColumn = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
    }

    textColumn.addView(
      TextView(this).apply {
        text = item.title
        textSize = 13f
        setTextColor(getColor(R.color.text_primary))
        maxLines = 2
        if (item.completedToday) {
          alpha = 0.55f
        }
      },
      matchWrap(),
    )

    val meta = buildMeta(item)
    if (meta.isNotBlank()) {
      textColumn.addView(
        TextView(this).apply {
          text = meta
          textSize = 10f
          setTextColor(
            getColor(if (item.isOverdue) R.color.warn else R.color.text_secondary),
          )
        },
        matchWrap(topMargin = dp(2)),
      )
    }

    val doneButton = ImageButton(this).apply {
      background = getDrawable(
        if (item.completedToday) R.drawable.circle_surface else R.drawable.bg_icon_primary,
      )
      setImageResource(R.drawable.ic_check)
      scaleType = ImageView.ScaleType.CENTER_INSIDE
      stateListAnimator = null
      contentDescription = "Complete ${item.title}"
      isEnabled = !item.completedToday
      alpha = if (item.completedToday) 0.6f else 1f
      setOnClickListener { completeItem(item, row, this) }
    }

    row.addView(
      textColumn,
      LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
    )
    row.addView(
      doneButton,
      LinearLayout.LayoutParams(dp(34), dp(34)).apply { marginStart = dp(8) },
    )
    return row
  }

  private fun buildMeta(item: AgendaItem): String {
    val parts = mutableListOf<String>()
    when {
      item.completedToday -> parts.add("Done today")
      item.isOverdue -> parts.add("Overdue")
      item.timeLabel != null -> parts.add(item.timeLabel)
    }
    if (item.isHabit) {
      parts.add("Habit")
    }
    item.category?.let { parts.add(it) }
    return parts.joinToString(" · ")
  }

  private fun completeItem(item: AgendaItem, row: View, button: ImageButton) {
    if (isBusy) {
      return
    }
    val credentials = MovaWearStorage.getCredentials(this) ?: run {
      setStatus("Open Mova on your phone to sync")
      return
    }

    isBusy = true
    button.isEnabled = false
    row.alpha = 0.5f
    Thread {
      val result = AgendaClient.complete(credentials, item)
      runOnUiThread {
        isBusy = false
        if (result.success) {
          TileService.getUpdater(this)
            .requestUpdate(AgendaTileService::class.java)
          // Reload so repeating items, counts and ordering stay authoritative.
          refresh()
        } else {
          row.alpha = 1f
          button.isEnabled = true
          setStatus(result.message)
        }
      }
    }.start()
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

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()
}
