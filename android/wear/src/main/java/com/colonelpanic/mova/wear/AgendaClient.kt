package com.colonelpanic.mova.wear

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * A single actionable entry from today's org agenda.
 *
 * [key] is a stable identifier used to correlate a rendered row with the
 * server-side item across a refetch (the org id when present, otherwise the
 * file+position pair). [isHabit]/[completedToday] let the UI show a habit's
 * recurring nature and whether it has already been logged for today.
 */
data class AgendaItem(
  val title: String,
  val state: String,
  val category: String?,
  val priority: String?,
  val timeLabel: String?,
  val relevance: String?,
  val id: String?,
  val file: String?,
  val pos: Int?,
  val isHabit: Boolean,
  val completedToday: Boolean,
) {
  val key: String
    get() = id ?: "$file@$pos"

  val isOverdue: Boolean
    get() = relevance == "overdue"

  /** Identifier fields the /complete endpoint uses to locate this item. */
  fun identifier(): JSONObject {
    val json = JSONObject()
    if (!id.isNullOrBlank()) {
      json.put("id", id)
    } else {
      json.put("file", file ?: JSONObject.NULL)
      json.put("pos", pos ?: JSONObject.NULL)
      json.put("title", title)
    }
    return json
  }
}

data class AgendaResult(
  val success: Boolean,
  val items: List<AgendaItem>,
  val message: String,
)

object AgendaClient {
  /** The state a quick "done" tap moves an item into. Matches the org default. */
  const val DONE_STATE = "DONE"

  /**
   * Fetch today's agenda, including overdue items. Completed non-habit entries
   * are dropped so the list only shows outstanding work; habits are kept (with
   * [AgendaItem.completedToday]) so a recurring item stays visible after being
   * logged for the day.
   */
  fun getAgenda(credentials: WearCredentials): AgendaResult {
    val connection = try {
      URL("${credentials.apiUrl}/agenda?span=day&include_overdue=true")
        .openConnection() as HttpURLConnection
    } catch (_: Exception) {
      return AgendaResult(false, emptyList(), "Invalid server URL")
    }

    return try {
      connection.requestMethod = "GET"
      connection.connectTimeout = 8000
      connection.readTimeout = 12000
      connection.setRequestProperty("Accept", "application/json")
      connection.setRequestProperty("Authorization", credentials.authHeader())

      when (val responseCode = connection.responseCode) {
        in 200..299 -> {
          val response = connection.inputStream.bufferedReader().use { it.readText() }
          AgendaResult(true, parseEntries(JSONObject(response)), "Loaded")
        }
        401 -> AgendaResult(false, emptyList(), "Authentication failed")
        else -> AgendaResult(false, emptyList(), "Server error $responseCode")
      }
    } catch (_: Exception) {
      AgendaResult(false, emptyList(), "Network error")
    } finally {
      connection.disconnect()
    }
  }

  /** Move [item] into the done state, recording the completion server-side. */
  fun complete(credentials: WearCredentials, item: AgendaItem): CaptureResult {
    val connection = try {
      URL("${credentials.apiUrl}/complete").openConnection() as HttpURLConnection
    } catch (_: Exception) {
      return CaptureResult(false, "Invalid server URL")
    }

    return try {
      connection.requestMethod = "POST"
      connection.connectTimeout = 8000
      connection.readTimeout = 12000
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("Authorization", credentials.authHeader())

      val body = item.identifier().put("state", DONE_STATE).toString()
      connection.outputStream.use { stream ->
        stream.write(body.toByteArray(Charsets.UTF_8))
      }

      when (val responseCode = connection.responseCode) {
        in 200..299 -> CaptureResult(true, "Done")
        401 -> CaptureResult(false, "Authentication failed")
        else -> CaptureResult(false, "Server error $responseCode")
      }
    } catch (_: Exception) {
      CaptureResult(false, "Network error")
    } finally {
      connection.disconnect()
    }
  }

  /**
   * Flatten a single- or multi-day agenda response into outstanding items.
   * Single-day responses carry an "entries" array; multi-day responses carry a
   * "days" object of date -> entries which we merge in order.
   */
  private fun parseEntries(json: JSONObject): List<AgendaItem> {
    val entryArrays = mutableListOf<JSONArray>()
    json.optJSONArray("entries")?.let { entryArrays.add(it) }
    json.optJSONObject("days")?.let { days ->
      days.keys().asSequence().sorted().forEach { date ->
        days.optJSONArray(date)?.let { entryArrays.add(it) }
      }
    }

    val items = entryArrays.flatMap { array ->
      (0 until array.length()).mapNotNull { index ->
        parseEntry(array.optJSONObject(index) ?: return@mapNotNull null)
      }
    }

    // De-duplicate items that appear under multiple dates (e.g. overdue items
    // echoed onto today) by their stable key, keeping the first occurrence.
    val seen = HashSet<String>()
    val deduped = items.filter { seen.add(it.key) }

    // Outstanding work first: overdue, then timed, then the rest; completed
    // habits sink to the bottom since there's nothing left to do on them today.
    return deduped.sortedWith(
      compareBy(
        { it.completedToday },
        { !it.isOverdue },
        { it.timeLabel == null },
        { it.timeLabel ?: "" },
      ),
    )
  }

  private fun parseEntry(entry: JSONObject): AgendaItem? {
    val title = entry.optString("title").ifBlank { entry.optString("agendaLine") }
    if (title.isBlank()) {
      return null
    }

    val state = entry.optString("todo").takeIf { it.isNotBlank() } ?: ""
    val relevance = entry.optString("dateRelevance").takeIf { it.isNotBlank() }
    val isHabit = entry.optBoolean("isWindowHabit", false)
    val completedToday = relevance == "completed" ||
      entry.optBoolean("habitCompletedOnQueryDate", false)

    // Drop finished one-off items; keep habits so they stay glanceable.
    if (completedToday && !isHabit) {
      return null
    }

    val idValue = entry.optString("id").takeIf { it.isNotBlank() && it != "null" }
    val fileValue = entry.optString("file").takeIf { it.isNotBlank() && it != "null" }
    val posValue = if (entry.has("pos") && !entry.isNull("pos")) {
      entry.optInt("pos")
    } else {
      null
    }
    if (idValue == null && (fileValue == null || posValue == null)) {
      // Without an identifier the item can't be completed; skip it.
      return null
    }

    val category = entry.optString("effectiveCategory").takeIf { it.isNotBlank() }
      ?: entry.optString("category").takeIf { it.isNotBlank() }

    return AgendaItem(
      title = title,
      state = state,
      category = category,
      priority = entry.optString("priority").takeIf { it.isNotBlank() && it != "null" },
      timeLabel = parseTimeLabel(entry),
      relevance = relevance,
      id = idValue,
      file = fileValue,
      pos = posValue,
      isHabit = isHabit,
      completedToday = completedToday,
    )
  }

  /** Prefer a scheduled time-of-day, falling back to a deadline time. */
  private fun parseTimeLabel(entry: JSONObject): String? {
    for (field in listOf("scheduled", "deadline")) {
      val stamp = entry.optJSONObject(field) ?: continue
      val time = stamp.optString("time").takeIf { it.isNotBlank() && it != "null" }
      if (time != null) {
        return time
      }
    }
    return null
  }

  private fun WearCredentials.authHeader(): String {
    val token = "$username:$password"
    return "Basic " + Base64.encodeToString(token.toByteArray(), Base64.NO_WRAP)
  }
}
