package com.colonelpanic.mova.intents

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.colonelpanic.mova.ApiResult
import com.colonelpanic.mova.MovaClient
import com.colonelpanic.mova.MovaEvents
import com.colonelpanic.mova.QuickCaptureActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * Invisible dispatcher for the mutating `mova://` hosts (create, complete,
 * update, reschedule, delete, refresh). Runs the request against the server
 * natively without interactive confirmation, toasts the outcome, and reports
 * it to `startActivityForResult` callers through [setResult].
 */
class IntentActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_STATUS = "status"
        const val EXTRA_TITLE = "title"
        const val EXTRA_ID = "id"
        const val EXTRA_FILE = "file"
        const val EXTRA_POS = "pos"
        const val EXTRA_TEMPLATE = "template"
        const val EXTRA_ERROR = "error"

        fun queryParams(uri: Uri): Map<String, List<String>> =
            uri.queryParameterNames.associateWith { uri.getQueryParameters(it) }
    }

    private class Outcome(val message: String, val extras: Map<String, Any?>)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) {
            finish()
            return
        }
        val uri = intent?.data
        if (uri == null) {
            fail("No action given")
            return
        }
        val host = uri.host ?: uri.path?.trim('/') ?: ""
        if (host == IntentParser.HOST_CREATE && uri.getQueryParameter("title").isNullOrBlank()) {
            openCaptureDialog(uri)
            return
        }
        val request = try {
            IntentParser.parse(host, queryParams(uri))
        } catch (e: IntentParseException) {
            fail(e.message ?: "Invalid request")
            return
        }

        execute(request)
    }

    /** `create` without a title is a request for the typing dialog. */
    private fun openCaptureDialog(uri: Uri) {
        val capture = Uri.Builder().scheme("mova").authority("capture")
        uri.getQueryParameter("template")?.let { capture.appendQueryParameter("template", it) }
        startActivity(Intent(this, QuickCaptureActivity::class.java).setData(capture.build()))
        setResult(RESULT_CANCELED, Intent().putExtra(EXTRA_ERROR, "Opened capture dialog"))
        finish()
    }

    private fun execute(request: IntentRequest) {
        CoroutineScope(Dispatchers.IO).launch {
            val result = run(request)
            if (result is ApiResult.Ok) MovaEvents.dataChanged(this@IntentActivity)
            withContext(Dispatchers.Main) {
                when (result) {
                    is ApiResult.Ok -> succeed(result.value)
                    is ApiResult.Err -> fail(result.message)
                }
            }
        }
    }

    private fun run(request: IntentRequest): ApiResult<Outcome> {
        val client = MovaClient.fromPrefs(this) ?: return ApiResult.Err(MovaClient.NOT_LOGGED_IN)
        return when (request) {
            is IntentRequest.Create -> runCreate(client, request)
            is IntentRequest.Complete ->
                client.complete(request.ref, request.state, request.overrideDate, request.strict).map { json ->
                    Outcome("Completed: ${json.optString("title").ifEmpty { request.ref.describe() }}", responseExtras(json))
                }
            is IntentRequest.Update ->
                client.update(request.ref, request.updatesJson(), request.strict).map { json ->
                    Outcome("Updated: ${json.optString("title").ifEmpty { request.ref.describe() }}", responseExtras(json))
                }
            is IntentRequest.Delete ->
                client.delete(request.ref).map { json ->
                    Outcome("Deleted: ${json.optString("title").ifEmpty { request.ref.describe() }}", responseExtras(json))
                }
            is IntentRequest.Refresh -> {
                val result = if (request.git) {
                    client.getAgenda(null, "day", null, null, refresh = true).map { }
                } else {
                    ApiResult.Ok(Unit)
                }
                result.map { Outcome("Refreshed", mapOf(EXTRA_STATUS to "refreshed")) }
            }
        }
    }

    private fun runCreate(client: MovaClient, request: IntentRequest.Create): ApiResult<Outcome> {
        val templateKey = request.template ?: MovaClient.defaultTemplate(this)
        val template = when (val templates = client.getTemplates()) {
            is ApiResult.Err -> return templates
            is ApiResult.Ok -> templates.value[templateKey]
                ?: return ApiResult.Err("Unknown template '$templateKey'")
        }
        val values = try {
            CaptureMapper.buildValues(template, request)
        } catch (e: IntentParseException) {
            return ApiResult.Err(e.message ?: "Invalid value")
        }
        val missing = CaptureMapper.missingRequired(template, values)
        if (missing.isNotEmpty()) {
            return ApiResult.Err("Template '$templateKey' needs: ${missing.joinToString(", ")}")
        }
        return client.capture(templateKey, values).map { json ->
            Outcome(
                "Created: ${request.title}",
                responseExtras(json) + mapOf(EXTRA_TITLE to request.title, EXTRA_TEMPLATE to templateKey),
            )
        }
    }

    private fun responseExtras(json: JSONObject): Map<String, Any?> = buildMap {
        put(EXTRA_STATUS, json.optString("status").ifEmpty { if (json.optBoolean("deleted")) "deleted" else null })
        listOf(EXTRA_TITLE, EXTRA_ID, EXTRA_FILE).forEach { key ->
            json.optString(key).takeIf { it.isNotEmpty() }?.let { put(key, it) }
        }
        if (json.has("pos") && !json.isNull("pos")) put(EXTRA_POS, json.optInt("pos"))
    }

    private fun succeed(outcome: Outcome) {
        Toast.makeText(applicationContext, outcome.message, Toast.LENGTH_SHORT).show()
        val data = Intent()
        for ((key, value) in outcome.extras) {
            when (value) {
                is String -> data.putExtra(key, value)
                is Int -> data.putExtra(key, value)
            }
        }
        setResult(RESULT_OK, data)
        finish()
    }

    private fun fail(message: String) {
        Toast.makeText(applicationContext, "Mova: $message", Toast.LENGTH_LONG).show()
        setResult(RESULT_CANCELED, Intent().putExtra(EXTRA_ERROR, message))
        finish()
    }

}
