package com.colonelpanic.mova.intents

import java.net.URLEncoder
import org.json.JSONArray
import org.json.JSONObject

object TemplateProviderRows {
    const val COL_KEY = "key"
    const val COL_NAME = "name"
    const val COL_IS_DEFAULT = "is_default"
    const val COL_TITLE_PROMPT = "title_prompt"
    const val COL_PROMPTS_JSON = "prompts_json"
    const val COL_CAPTURE_URI = "capture_uri"

    val ALL_COLUMNS = arrayOf(
        COL_KEY,
        COL_NAME,
        COL_IS_DEFAULT,
        COL_TITLE_PROMPT,
        COL_PROMPTS_JSON,
        COL_CAPTURE_URI,
    )

    fun row(template: TemplateInfo, columns: Array<String>, defaultTemplate: String): Array<Any?> =
        columns.map { column ->
            when (column) {
                COL_KEY -> template.key
                COL_NAME -> template.name
                COL_IS_DEFAULT -> if (template.key == defaultTemplate) 1 else 0
                COL_TITLE_PROMPT -> template.titlePrompt
                COL_PROMPTS_JSON -> promptsJson(template)
                COL_CAPTURE_URI -> captureUri(template.key)
                else -> null
            }
        }.toTypedArray()

    private fun promptsJson(template: TemplateInfo): String = JSONArray().apply {
        template.prompts.forEach { prompt ->
            put(
                JSONObject()
                    .put("name", prompt.name)
                    .put("type", prompt.type)
                    .put("required", prompt.required),
            )
        }
    }.toString()

    private fun captureUri(key: String): String =
        "mova://capture?template=${URLEncoder.encode(key, "UTF-8")}"
}
