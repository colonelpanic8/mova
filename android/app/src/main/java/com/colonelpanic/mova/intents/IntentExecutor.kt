package com.colonelpanic.mova.intents

import com.colonelpanic.mova.ApiResult
import com.colonelpanic.mova.Delivery
import com.colonelpanic.mova.MovaClient
import org.json.JSONObject

/**
 * Runs a parsed [IntentRequest] against the server. Shared by the `mova://`
 * activity and the EVA extension service so both apply the same semantics.
 */
class IntentExecutor(private val client: MovaClient, private val defaultTemplate: () -> String) {

    data class Outcome(val message: String, val extras: Map<String, Any?>, val response: JSONObject)

    companion object {
        const val EXTRA_STATUS = "status"
        const val EXTRA_TITLE = "title"
        const val EXTRA_ID = "id"
        const val EXTRA_FILE = "file"
        const val EXTRA_POS = "pos"
        const val EXTRA_TEMPLATE = "template"

        /** Whether a 2xx body carries the server's own evidence that [request] was applied. */
        fun confirmsApplied(request: IntentRequest, response: JSONObject): Boolean = when (request) {
            is IntentRequest.Create -> response.optString("status") == "created"
            is IntentRequest.Complete -> response.optString("status") == "completed"
            is IntentRequest.Update -> response.optString("status") == "updated"
            is IntentRequest.Delete -> response.optBoolean("deleted") || response.optString("status") == "deleted"
            is IntentRequest.Refresh -> true
        }

        fun responseExtras(json: JSONObject): Map<String, Any?> = buildMap {
            put(EXTRA_STATUS, json.optString("status").ifEmpty { if (json.optBoolean("deleted")) "deleted" else null })
            listOf(EXTRA_TITLE, EXTRA_ID, EXTRA_FILE).forEach { key ->
                json.optString(key).takeIf { it.isNotEmpty() }?.let { put(key, it) }
            }
            if (json.has("pos") && !json.isNull("pos")) put(EXTRA_POS, json.optInt("pos"))
        }
    }

    fun run(request: IntentRequest): ApiResult<Outcome> = when (request) {
        is IntentRequest.Create -> runCreate(request)
        is IntentRequest.Complete ->
            client.complete(request.ref, request.state, request.overrideDate, request.strict).map { json ->
                Outcome("Completed: ${json.optString("title").ifEmpty { request.ref.describe() }}", responseExtras(json), json)
            }
        is IntentRequest.Update ->
            client.update(request.ref, request.updatesJson(), request.strict).map { json ->
                Outcome("Updated: ${json.optString("title").ifEmpty { request.ref.describe() }}", responseExtras(json), json)
            }
        is IntentRequest.Delete ->
            client.delete(request.ref).map { json ->
                Outcome("Deleted: ${json.optString("title").ifEmpty { request.ref.describe() }}", responseExtras(json), json)
            }
        is IntentRequest.Refresh -> {
            val result = if (request.git) {
                client.getAgenda(null, "day", null, null, refresh = true).map { }
            } else {
                ApiResult.Ok(Unit)
            }
            result.map { Outcome("Refreshed", mapOf(EXTRA_STATUS to "refreshed"), JSONObject()) }
        }
    }

    private fun runCreate(request: IntentRequest.Create): ApiResult<Outcome> {
        val templateKey = request.template ?: defaultTemplate()
        val template = when (val templates = client.getTemplates()) {
            // The template lookup is a read; failing it means /capture was never sent.
            is ApiResult.Err -> return templates.copy(delivery = Delivery.NOT_SENT)
            is ApiResult.Ok -> templates.value[templateKey]
                ?: return ApiResult.Err("Unknown template '$templateKey'", invalid = true)
        }
        val values = try {
            CaptureMapper.buildValues(template, request)
        } catch (e: IntentParseException) {
            return ApiResult.Err(e.message ?: "Invalid value", invalid = true)
        }
        val missing = CaptureMapper.missingRequired(template, values)
        if (missing.isNotEmpty()) {
            return ApiResult.Err("Template '$templateKey' needs: ${missing.joinToString(", ")}", invalid = true)
        }
        return client.capture(templateKey, values).map { json ->
            Outcome(
                "Created: ${request.title}",
                responseExtras(json) + mapOf(EXTRA_TITLE to request.title, EXTRA_TEMPLATE to templateKey),
                json,
            )
        }
    }
}
