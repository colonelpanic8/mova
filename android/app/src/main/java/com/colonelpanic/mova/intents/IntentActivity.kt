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

/**
 * Invisible dispatcher for the mutating `mova://` hosts (create, complete,
 * update, reschedule, delete, refresh). Runs the request against the server
 * natively without interactive confirmation, toasts the outcome, and reports
 * it to `startActivityForResult` callers through [setResult].
 */
class IntentActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ERROR = "error"

        fun queryParams(uri: Uri): Map<String, List<String>> =
            uri.queryParameterNames.associateWith { uri.getQueryParameters(it) }
    }

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
            val result = MovaClient.fromPrefs(this@IntentActivity)
                ?.let { client -> IntentExecutor(client) { MovaClient.defaultTemplate(this@IntentActivity) }.run(request) }
                ?: ApiResult.Err(MovaClient.NOT_LOGGED_IN)
            if (result is ApiResult.Ok) MovaEvents.dataChanged(this@IntentActivity)
            withContext(Dispatchers.Main) {
                when (result) {
                    is ApiResult.Ok -> succeed(result.value)
                    is ApiResult.Err -> fail(result.message)
                }
            }
        }
    }

    private fun succeed(outcome: IntentExecutor.Outcome) {
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
