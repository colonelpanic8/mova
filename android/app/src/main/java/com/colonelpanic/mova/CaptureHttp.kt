package com.colonelpanic.mova

import android.content.Context
import com.colonelpanic.mova.intents.CaptureMapper
import com.colonelpanic.mova.intents.IntentRequest
import com.colonelpanic.mova.intents.TodoFields
import org.json.JSONObject

/**
 * Single-field capture used by QuickCaptureActivity (typing dialog) and
 * VoiceQuickCaptureActivity (voice trampoline): the text goes into the
 * template's first required string prompt.
 */
object CaptureHttp {

    data class CaptureResult(val success: Boolean, val error: String? = null)

    /**
     * Submit [text] using [templateKey]. The legacy "__quick_capture__"
     * sentinel (and empty selection) maps to the server's "default" template.
     */
    fun capture(context: Context, text: String, templateKey: String?): CaptureResult {
        val effectiveTemplateKey =
            if (templateKey == "__quick_capture__" || templateKey.isNullOrEmpty()) {
                "default"
            } else {
                templateKey
            }
        return captureWithTemplate(context, text, effectiveTemplateKey)
    }

    private fun captureWithTemplate(context: Context, text: String, templateKey: String): CaptureResult {
        val client = MovaClient.fromPrefs(context)
            ?: return CaptureResult(false, "Please log in to the Mova app first")

        val template = when (val templates = client.getTemplates()) {
            is ApiResult.Err -> return CaptureResult(false, "Failed to load template")
            is ApiResult.Ok -> templates.value[templateKey]
                ?: return CaptureResult(false, "Failed to load template")
        }

        val request = IntentRequest.Create(
            title = text,
            template = templateKey,
            fields = TodoFields(),
            extras = emptyMap(),
        )
        val values: JSONObject = CaptureMapper.buildValues(template, request)
        return when (val result = client.capture(templateKey, values)) {
            is ApiResult.Ok -> CaptureResult(true)
            is ApiResult.Err -> CaptureResult(false, result.message)
        }
    }
}
