package com.colonelpanic.mova.intents

import org.json.JSONArray
import org.json.JSONObject

data class TemplatePrompt(val name: String, val type: String, val required: Boolean)

data class TemplateInfo(val key: String, val name: String, val prompts: List<TemplatePrompt>) {
    /** The prompt the free-text title goes into: first required string prompt, else first prompt, else "Title". */
    val titlePrompt: String
        get() = prompts.firstOrNull { it.type == "string" && it.required }?.name
            ?: prompts.firstOrNull()?.name
            ?: "Title"

    companion object {
        fun fromJson(key: String, json: JSONObject): TemplateInfo {
            val promptsJson = json.optJSONArray("prompts") ?: JSONArray()
            val prompts = (0 until promptsJson.length()).map { i ->
                val p = promptsJson.getJSONObject(i)
                TemplatePrompt(
                    name = p.getString("name"),
                    type = p.optString("type", "string"),
                    required = p.optBoolean("required", false),
                )
            }
            return TemplateInfo(key, json.optString("name", key), prompts)
        }
    }
}

/** Builds the `values` object for POST /capture from a [IntentRequest.Create]. */
object CaptureMapper {

    private val UNIVERSAL_KEYS = setOf("scheduled", "deadline", "priority", "tags", "state")

    fun buildValues(template: TemplateInfo, request: IntentRequest.Create): JSONObject {
        val values = JSONObject()
        values.put(template.titlePrompt, request.title)

        val fields = request.fields
        (fields.scheduled as? Patch.Set)?.let { values.put("scheduled", it.value.toJson()) }
        (fields.deadline as? Patch.Set)?.let { values.put("deadline", it.value.toJson()) }
        (fields.priority as? Patch.Set)?.let { values.put("priority", it.value) }
        (fields.tags as? Patch.Set)?.let { values.put("tags", JSONArray(it.value)) }
        (fields.state as? Patch.Set)?.let { values.put("state", it.value) }
        (fields.body as? Patch.Set)?.let { values.put("body", it.value) }

        for ((key, raw) in request.extras) {
            val prompt = template.prompts.firstOrNull { it.name.equals(key, ignoreCase = true) } ?: continue
            if (prompt.name == template.titlePrompt || prompt.name in UNIVERSAL_KEYS) continue
            values.put(prompt.name, promptValue(prompt, raw))
        }
        return values
    }

    /** Prompt names (other than the title prompt) still required after mapping. */
    fun missingRequired(template: TemplateInfo, values: JSONObject): List<String> =
        template.prompts.filter { it.required && !values.has(it.name) }.map { it.name }

    private fun promptValue(prompt: TemplatePrompt, raw: String): Any = when (prompt.type) {
        "date" -> OrgTimestamp.parse(raw).date
        "tags" -> JSONArray(raw.split(",").map { it.trim() }.filter { it.isNotEmpty() })
        else -> raw
    }
}
