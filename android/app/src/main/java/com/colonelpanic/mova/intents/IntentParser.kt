package com.colonelpanic.mova.intents

/**
 * Turns a `mova://<host>?<query>` link into an [IntentRequest]. Pure so it can
 * be unit tested on the JVM; the activity adapts `android.net.Uri` into the
 * `host` + multi-valued `params` form.
 */
object IntentParser {

    const val HOST_CREATE = "create"
    const val HOST_COMPLETE = "complete"
    const val HOST_UPDATE = "update"
    const val HOST_RESCHEDULE = "reschedule"
    const val HOST_DELETE = "delete"
    const val HOST_REFRESH = "refresh"

    val HEADLESS_HOSTS = setOf(
        HOST_CREATE, HOST_COMPLETE, HOST_UPDATE, HOST_RESCHEDULE, HOST_DELETE, HOST_REFRESH,
    )

    private val REF_KEYS = setOf("id", "file", "pos", "title")
    private val FIELD_KEYS = setOf("scheduled", "deadline", "priority", "tags", "state", "body")
    private val CONTROL_KEYS = setOf("confirm", "strict", "template", "new_title", "date", "git")

    fun parse(host: String, params: Map<String, List<String>>): IntentRequest {
        val p = Params(params)
        return when (host.lowercase()) {
            HOST_CREATE -> parseCreate(p)
            HOST_COMPLETE -> IntentRequest.Complete(
                ref = requireRef(p, allowTitleOnly = true),
                state = p.first("state")?.trim()?.takeIf { it.isNotEmpty() } ?: "DONE",
                overrideDate = p.first("date")?.trim()?.takeIf { it.isNotEmpty() }?.also { validateDate(it) },
                strict = p.flag("strict"),
            )
            HOST_UPDATE, HOST_RESCHEDULE -> {
                val fields = parseFields(p, allowClear = true)
                val newTitle = p.first("new_title")?.trim()?.takeIf { it.isNotEmpty() }
                if (fields.isEmpty && newTitle == null) {
                    throw IntentParseException(
                        "Nothing to update: pass at least one of new_title, scheduled, deadline, priority, tags, state, body"
                    )
                }
                IntentRequest.Update(
                    ref = requireRef(p, allowTitleOnly = true),
                    newTitle = newTitle,
                    fields = fields,
                    strict = p.flag("strict"),
                )
            }
            HOST_DELETE -> {
                val ref = requireRef(p, allowTitleOnly = false)
                IntentRequest.Delete(ref)
            }
            HOST_REFRESH -> IntentRequest.Refresh(git = p.flag("git"))
            else -> throw IntentParseException("Unknown action '$host'")
        }
    }

    private fun parseCreate(p: Params): IntentRequest.Create {
        val title = p.first("title")?.trim()
        if (title.isNullOrEmpty()) throw IntentParseException("Missing required parameter 'title'")
        val extras = p.all
            .filterKeys { it !in REF_KEYS && it !in FIELD_KEYS && it !in CONTROL_KEYS }
            .mapValues { (_, values) -> values.first() }
        return IntentRequest.Create(
            title = title,
            template = p.first("template")?.trim()?.takeIf { it.isNotEmpty() },
            fields = parseFields(p, allowClear = false),
            extras = extras,
        )
    }

    private fun parseFields(p: Params, allowClear: Boolean): TodoFields {
        fun <T> patch(key: String, convert: (String) -> T): Patch<T>? {
            val raw = p.first(key) ?: return null
            if (raw.isBlank()) return if (allowClear) Patch.Clear else null
            return Patch.Set(convert(raw))
        }
        val tagValues = p.all["tags"]
        val tags: Patch<List<String>>? = when {
            tagValues == null -> null
            else -> {
                val list = tagValues.flatMap { it.split(",") }.map { it.trim() }.filter { it.isNotEmpty() }
                if (list.isEmpty()) (if (allowClear) Patch.Clear else null) else Patch.Set(list)
            }
        }
        return TodoFields(
            scheduled = patch("scheduled") { OrgTimestamp.parse(it) },
            deadline = patch("deadline") { OrgTimestamp.parse(it) },
            priority = patch("priority") { parsePriority(it) },
            tags = tags,
            state = patch("state") { it.trim() },
            body = patch("body") { it },
        )
    }

    private fun parsePriority(raw: String): String {
        val value = raw.trim().uppercase()
        if (value.length != 1 || value[0] !in 'A'..'Z') {
            throw IntentParseException("Invalid priority '$raw' (expected a single letter such as A)")
        }
        return value
    }

    private fun validateDate(raw: String) {
        if (!Regex("""^\d{4}-\d{2}-\d{2}$""").matches(raw)) {
            throw IntentParseException("Invalid date '$raw' (expected YYYY-MM-DD)")
        }
    }

    private fun requireRef(p: Params, allowTitleOnly: Boolean): TodoRef {
        val posRaw = p.first("pos")?.trim()?.takeIf { it.isNotEmpty() }
        val pos = posRaw?.let {
            it.toIntOrNull() ?: throw IntentParseException("Invalid pos '$it' (expected an integer)")
        }
        val ref = TodoRef(
            id = p.first("id")?.trim()?.takeIf { it.isNotEmpty() },
            file = p.first("file")?.trim()?.takeIf { it.isNotEmpty() },
            pos = pos,
            title = p.first("title")?.trim()?.takeIf { it.isNotEmpty() },
        )
        if (ref.isEmpty) throw IntentParseException("Missing todo reference: pass id, or file and pos, or title")
        if (!ref.isPrecise && !allowTitleOnly) {
            throw IntentParseException("This action needs id, or file and pos")
        }
        if (!ref.isPrecise && ref.title == null) {
            throw IntentParseException("Missing todo reference: pass id, or file and pos, or title")
        }
        return ref
    }

    private class Params(val all: Map<String, List<String>>) {
        fun first(key: String): String? = all[key]?.firstOrNull()
        fun flag(key: String): Boolean = first(key)?.trim()?.lowercase() in setOf("true", "1", "yes")
    }
}
