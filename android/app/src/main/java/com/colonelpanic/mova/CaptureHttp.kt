package com.colonelpanic.mova

import android.content.Context
import android.util.Base64
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/**
 * Shared HTTP capture logic used by both QuickCaptureActivity (typing dialog)
 * and VoiceQuickCaptureActivity (voice trampoline). Extracted verbatim from
 * QuickCaptureActivity so both surfaces submit through the identical path,
 * honoring the per-widget template selection stored in MovaSharedPrefs.
 */
object CaptureHttp {

    data class CaptureResult(val success: Boolean, val error: String? = null)

    private fun getCredentials(context: Context): Triple<String, String, String>? {
        val prefs = MovaSharedPrefs.get(context)
        val apiUrl = prefs.getString("mova_api_url", null)
        val username = prefs.getString("mova_username", null)
        val password = prefs.getString("mova_password", null)

        return if (apiUrl != null && username != null && password != null) {
            Triple(apiUrl, username, password)
        } else {
            null
        }
    }

    /**
     * Submit [text] using the template stored for a widget. The legacy
     * "__quick_capture__" sentinel (and empty selection) maps to the server's
     * "default" template, matching the previous QuickCaptureActivity behavior.
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

    private fun captureWithTemplate(context: Context, text: String, templateKeyToUse: String): CaptureResult {
        try {
            val credentials = getCredentials(context)
                ?: return CaptureResult(false, "Please log in to the Mova app first")

            val (apiUrl, username, password) = credentials

            // First fetch the template to find the field name
            val fieldName = getTemplateFieldName(apiUrl, username, password, templateKeyToUse)
                ?: return CaptureResult(false, "Failed to load template")

            val url = URL("$apiUrl/capture")
            val connection = url.openConnection() as HttpURLConnection

            try {
                connection.connectTimeout = 8000
                connection.readTimeout = 12000
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")

                val basicAuth = "Basic " + Base64.encodeToString("$username:$password".toByteArray(), Base64.NO_WRAP)
                connection.setRequestProperty("Authorization", basicAuth)

                connection.doOutput = true
                connection.outputStream.use { os ->
                    val values = JSONObject().apply {
                        put(fieldName, text)
                    }
                    val jsonBody = JSONObject().apply {
                        put("template", templateKeyToUse)
                        put("values", values)
                    }.toString()
                    os.write(jsonBody.toByteArray())
                }

                val responseCode = connection.responseCode

                return when {
                    responseCode in 200..299 -> CaptureResult(true)
                    responseCode == 401 -> CaptureResult(false, "Authentication failed")
                    else -> {
                        val errorBody = try {
                            connection.errorStream?.bufferedReader()?.readText()
                        } catch (e: Exception) { null }
                        CaptureResult(false, "Server error: $responseCode - $errorBody")
                    }
                }
            } finally {
                connection.disconnect()
            }
        } catch (e: Exception) {
            return CaptureResult(false, "Network error: ${e.message}")
        }
    }

    private fun getTemplateFieldName(apiUrl: String, username: String, password: String, templateKeyToUse: String): String? {
        try {
            val url = URL("$apiUrl/capture-templates")
            val connection = url.openConnection() as HttpURLConnection

            try {
                connection.connectTimeout = 8000
                connection.readTimeout = 12000
                connection.requestMethod = "GET"
                val basicAuth = "Basic " + Base64.encodeToString("$username:$password".toByteArray(), Base64.NO_WRAP)
                connection.setRequestProperty("Authorization", basicAuth)

                if (connection.responseCode == 200) {
                    val response = connection.inputStream.bufferedReader().readText()
                    val json = JSONObject(response)

                    if (json.has(templateKeyToUse)) {
                        val template = json.getJSONObject(templateKeyToUse)
                        val prompts = template.getJSONArray("prompts")

                        // Find the first required string field, or default to "title"
                        for (i in 0 until prompts.length()) {
                            val prompt = prompts.getJSONObject(i)
                            if (prompt.getString("type") == "string" && prompt.getBoolean("required")) {
                                return prompt.getString("name")
                            }
                        }

                        // Fallback to first field or "title"
                        return if (prompts.length() > 0) {
                            prompts.getJSONObject(0).getString("name")
                        } else {
                            "title"
                        }
                    }
                }
                return null
            } finally {
                connection.disconnect()
            }
        } catch (e: Exception) {
            return null
        }
    }
}
