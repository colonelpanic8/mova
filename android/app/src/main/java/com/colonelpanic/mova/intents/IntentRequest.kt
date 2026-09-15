package com.colonelpanic.mova.intents

import org.json.JSONArray
import org.json.JSONObject

class IntentParseException(message: String) : Exception(message)

/** Identifies a todo the way the server's mutation endpoints expect. */
data class TodoRef(
    val id: String? = null,
    val file: String? = null,
    val pos: Int? = null,
    val title: String? = null,
) {
    val isEmpty: Boolean get() = id == null && file == null && pos == null && title == null

    /** True when the server can locate the todo without falling back to a title search. */
    val isPrecise: Boolean get() = id != null || (file != null && pos != null)

    fun describe(): String = title ?: id ?: "$file:$pos"

    fun writeTo(json: JSONObject) {
        id?.let { json.put("id", it) }
        file?.let { json.put("file", it) }
        pos?.let { json.put("pos", it) }
        title?.let { json.put("title", it) }
    }
}

data class Repeater(val type: String, val value: Int, val unit: String) {
    fun toJson(): JSONObject = JSONObject().put("type", type).put("value", value).put("unit", unit)
    override fun toString(): String = "$type$value$unit"
}

/** The `{date, time?, repeater?}` timestamp object shared by /capture and /update. */
data class OrgTimestamp(val date: String, val time: String? = null, val repeater: Repeater? = null) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("date", date)
        time?.let { put("time", it) }
        repeater?.let { put("repeater", it.toJson()) }
    }

    override fun toString(): String =
        listOfNotNull(date, time, repeater?.toString()).joinToString(" ")

    companion object {
        private val PATTERN = Regex(
            """^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}:\d{2})(?::\d{2})?)?(?:\s+(\+\+|\.\+|\+)(\d+)([dwmy]))?$"""
        )

        /**
         * Parses `YYYY-MM-DD`, `YYYY-MM-DDTHH:MM`, optionally followed by a
         * space and an org repeater such as `+1w`, `++1d` or `.+2m`.
         */
        fun parse(raw: String): OrgTimestamp {
            val match = PATTERN.matchEntire(raw.trim())
                ?: throw IntentParseException(
                    "Invalid timestamp '$raw' (expected YYYY-MM-DD or YYYY-MM-DDTHH:MM, optional repeater like +1w)"
                )
            val (date, time, repeaterType, repeaterValue, repeaterUnit) = match.destructured
            val normalizedTime = time.takeIf { it.isNotEmpty() }?.let {
                val (h, m) = it.split(":")
                "%02d:%s".format(h.toInt(), m)
            }
            val repeater = repeaterType.takeIf { it.isNotEmpty() }?.let {
                Repeater(it, repeaterValue.toInt(), repeaterUnit)
            }
            return OrgTimestamp(date, normalizedTime, repeater)
        }
    }
}

/** Fields shared by create and update, parsed from their query-string forms. */
data class TodoFields(
    val scheduled: Patch<OrgTimestamp>? = null,
    val deadline: Patch<OrgTimestamp>? = null,
    val priority: Patch<String>? = null,
    val tags: Patch<List<String>>? = null,
    val state: Patch<String>? = null,
    val body: Patch<String>? = null,
) {
    val isEmpty: Boolean
        get() = scheduled == null && deadline == null && priority == null &&
            tags == null && state == null && body == null

    fun describeLines(): List<String> = buildList {
        scheduled?.let { add("Scheduled: ${it.describe()}") }
        deadline?.let { add("Deadline: ${it.describe()}") }
        priority?.let { add("Priority: ${it.describe()}") }
        tags?.let { add("Tags: ${it.describe { tags -> tags.joinToString(", ") }}") }
        state?.let { add("State: ${it.describe()}") }
        body?.let { add("Body: ${it.describe()}") }
    }
}

/** A field that is either set to a value or explicitly cleared. Absent fields are null in [TodoFields]. */
sealed class Patch<out T> {
    object Clear : Patch<Nothing>()
    data class Set<T>(val value: T) : Patch<T>()

    fun describe(render: (T) -> String = { it.toString() }): String = when (this) {
        is Clear -> "cleared"
        is Set -> render(value)
    }

    fun toJsonValue(render: (T) -> Any): Any = when (this) {
        is Clear -> JSONObject.NULL
        is Set -> render(value)
    }
}

sealed class IntentRequest {
    /** Human-readable summary of the request. */
    abstract fun describe(): String

    data class Create(
        val title: String,
        val template: String?,
        val fields: TodoFields,
        /** Query params not recognised as intent fields, matched to template prompts by name. */
        val extras: Map<String, String>,
    ) : IntentRequest() {
        override fun describe(): String = buildString {
            append("Create \"$title\"")
            template?.let { append("\nTemplate: $it") }
            fields.describeLines().forEach { append("\n$it") }
        }
    }

    data class Complete(
        val ref: TodoRef,
        val state: String,
        val overrideDate: String?,
        val strict: Boolean,
    ) : IntentRequest() {
        override fun describe(): String = buildString {
            append("Mark \"${ref.describe()}\" as $state")
            overrideDate?.let { append("\nCompletion date: $it") }
        }
    }

    data class Update(
        val ref: TodoRef,
        val newTitle: String?,
        val fields: TodoFields,
        val strict: Boolean,
    ) : IntentRequest() {
        override fun describe(): String = buildString {
            append("Update \"${ref.describe()}\"")
            newTitle?.let { append("\nTitle: $it") }
            fields.describeLines().forEach { append("\n$it") }
        }

        fun updatesJson(): JSONObject = JSONObject().apply {
            newTitle?.let { put("new_title", it) }
            fields.scheduled?.let { put("scheduled", it.toJsonValue { ts -> ts.toJson() }) }
            fields.deadline?.let { put("deadline", it.toJsonValue { ts -> ts.toJson() }) }
            fields.priority?.let { put("priority", it.toJsonValue { p -> p }) }
            fields.tags?.let { put("tags", it.toJsonValue { tags -> JSONArray(tags) }) }
            fields.state?.let { put("state", it.toJsonValue { s -> s }) }
            fields.body?.let { put("body", it.toJsonValue { b -> b }) }
        }
    }

    data class Delete(val ref: TodoRef) : IntentRequest() {
        override fun describe(): String =
            "Delete \"${ref.describe()}\" permanently, including any sub-headings"
    }

    data class Refresh(val git: Boolean) : IntentRequest() {
        override fun describe(): String = if (git) "Refresh (git pull)" else "Refresh"
    }
}
