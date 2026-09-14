package com.colonelpanic.mova.intents

import java.net.URLEncoder
import org.json.JSONArray
import org.json.JSONObject

/** Column layout of the todo content provider, shared by /todos and /agenda. */
object ProviderRows {
    const val COL_ID = "id"
    const val COL_FILE = "file"
    const val COL_POS = "pos"
    const val COL_TITLE = "title"
    const val COL_STATE = "state"
    const val COL_PRIORITY = "priority"
    const val COL_SCHEDULED = "scheduled"
    const val COL_SCHEDULED_REPEATER = "scheduled_repeater"
    const val COL_DEADLINE = "deadline"
    const val COL_DEADLINE_REPEATER = "deadline_repeater"
    const val COL_TAGS = "tags"
    const val COL_CATEGORY = "category"
    const val COL_OLPATH = "olpath"
    const val COL_AGENDA_LINE = "agenda_line"
    const val COL_DATE_RELEVANCE = "date_relevance"
    const val COL_COMPLETED_AT = "completed_at"
    const val COL_OPEN_URI = "open_uri"

    val ALL_COLUMNS = arrayOf(
        COL_ID, COL_FILE, COL_POS, COL_TITLE, COL_STATE, COL_PRIORITY,
        COL_SCHEDULED, COL_SCHEDULED_REPEATER, COL_DEADLINE, COL_DEADLINE_REPEATER,
        COL_TAGS, COL_CATEGORY, COL_OLPATH, COL_AGENDA_LINE, COL_DATE_RELEVANCE,
        COL_COMPLETED_AT, COL_OPEN_URI,
    )

    fun row(todo: JSONObject, columns: Array<String>): Array<Any?> = columns.map { column ->
        when (column) {
            COL_ID -> string(todo, "id")
            COL_FILE -> string(todo, "file")
            COL_POS -> if (todo.isNull("pos")) null else todo.optInt("pos")
            COL_TITLE -> string(todo, "title")
            COL_STATE -> string(todo, "todo")
            COL_PRIORITY -> string(todo, "priority")
            COL_SCHEDULED -> timestamp(todo.optJSONObject("scheduled"))
            COL_SCHEDULED_REPEATER -> repeater(todo.optJSONObject("scheduled"))
            COL_DEADLINE -> timestamp(todo.optJSONObject("deadline"))
            COL_DEADLINE_REPEATER -> repeater(todo.optJSONObject("deadline"))
            COL_TAGS -> strings(todo.optJSONArray("tags"))?.joinToString(",")
            COL_CATEGORY -> string(todo, "category") ?: string(todo, "effectiveCategory")
            COL_OLPATH -> strings(todo.optJSONArray("olpath"))?.joinToString("/")
            COL_AGENDA_LINE -> string(todo, "agendaLine")
            COL_DATE_RELEVANCE -> string(todo, "dateRelevance")
            COL_COMPLETED_AT -> string(todo, "completedAt")
            COL_OPEN_URI -> openUri(todo)
            else -> null
        }
    }.toTypedArray()

    fun openUri(todo: JSONObject): String {
        val id = string(todo, "id")
        val params = if (id != null) {
            listOf("id" to id)
        } else {
            listOfNotNull(
                string(todo, "file")?.let { "file" to it },
                if (todo.isNull("pos")) null else "pos" to todo.optInt("pos").toString(),
                string(todo, "title")?.let { "title" to it },
            )
        }
        return "mova://open?" + params.joinToString("&") { (k, v) -> k + "=" + URLEncoder.encode(v, "UTF-8") }
    }

    private fun string(json: JSONObject, key: String): String? =
        if (json.isNull(key)) null else json.optString(key).takeIf { it.isNotEmpty() }

    private fun strings(array: JSONArray?): List<String>? =
        array?.let { arr -> (0 until arr.length()).mapNotNull { arr.optString(it).takeIf { s -> s.isNotEmpty() } } }

    private fun timestamp(ts: JSONObject?): String? {
        val date = ts?.let { string(it, "date") } ?: return null
        val time = string(ts, "time")
        return if (time != null) "${date}T$time" else date
    }

    private fun repeater(ts: JSONObject?): String? {
        val rep = ts?.optJSONObject("repeater") ?: return null
        val type = string(rep, "type") ?: return null
        return "$type${rep.optInt("value")}${string(rep, "unit").orEmpty()}"
    }
}
