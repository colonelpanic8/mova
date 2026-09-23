package com.colonelpanic.mova.eva

import java.security.MessageDigest
import org.json.JSONArray
import org.json.JSONObject

/** Wire constants and reply envelopes of EVA's installed-app AIDL protocol v1. */
object EvaProtocol {
    const val PROTOCOL_VERSION = 1

    const val MAX_DESCRIBE_BYTES = 65_536
    const val MAX_EXECUTE_BYTES = 16_384
    const val MAX_ARGUMENTS_BYTES = 16_384
    const val DESCRIBE_MAX_MILLIS = 5_000L

    const val STATUS_COMPLETED = "completed"
    const val STATUS_NOT_EXECUTED = "not_executed"
    const val STATUS_FAILED = "failed"
    const val STATUS_UNKNOWN = "unknown"

    const val REASON_STALE_DESCRIPTOR = "stale_descriptor"
    const val REASON_NOT_CONFIGURED = "not_configured"
    const val REASON_BUSY = "busy"
    const val REASON_INVALID_ARGUMENTS = "invalid_arguments"
    const val REASON_UNAUTHORIZED_CALLER = "unauthorized_caller"
    const val REASON_DEADLINE_EXCEEDED = "deadline_exceeded"

    data class Reply(
        val status: String,
        val reasonCode: String?,
        val text: String,
        val structured: JSONObject? = null,
        val truncated: Boolean = false,
    )

    fun completed(text: String, structured: JSONObject? = null, truncated: Boolean = false) =
        Reply(STATUS_COMPLETED, null, text, structured, truncated)

    fun notExecuted(reasonCode: String?, text: String, structured: JSONObject? = null) =
        Reply(STATUS_NOT_EXECUTED, reasonCode, text, structured)

    fun failed(text: String, structured: JSONObject? = null) = Reply(STATUS_FAILED, null, text, structured)

    fun unknown(text: String, reasonCode: String? = null, structured: JSONObject? = null) =
        Reply(STATUS_UNKNOWN, reasonCode, text, structured)

    fun executeEnvelope(reply: Reply, maxBytes: Int = MAX_EXECUTE_BYTES): String =
        envelope(reply, maxBytes) { json -> reply.structured?.let { json.put("structuredContent", it) } }

    fun describeEnvelope(descriptor: JSONObject): String =
        envelope(completed(""), MAX_DESCRIBE_BYTES) { it.put("descriptor", descriptor) }

    fun describeFailure(reply: Reply): String =
        envelope(reply, MAX_DESCRIBE_BYTES) { it.put("descriptor", JSONObject.NULL) }

    /**
     * Builds a reply, shortening only the human text until the whole payload
     * fits. Structured content is never cut; callers bound it beforehand.
     */
    private fun envelope(reply: Reply, maxBytes: Int, extra: (JSONObject) -> Unit): String {
        var text = reply.text
        var truncated = reply.truncated
        fun build(): String = JSONObject()
            .put("protocolVersion", PROTOCOL_VERSION)
            .put("status", reply.status)
            .put("reasonCode", reply.reasonCode ?: JSONObject.NULL)
            .put("truncated", truncated)
            .put("content", JSONArray().put(JSONObject().put("type", "text").put("text", text)))
            .also(extra)
            .toString()
        var json = build()
        while (utf8Length(json) > maxBytes && text.isNotEmpty()) {
            text = truncateCodePoints(text, text.codePointCount(0, text.length) * 3 / 4)
            truncated = true
            json = build()
        }
        return json
    }

    fun truncateCodePoints(text: String, maxCodePoints: Int): String {
        if (text.codePointCount(0, text.length) <= maxCodePoints) return text
        return text.substring(0, text.offsetByCodePoints(0, maxCodePoints))
    }

    fun utf8Length(text: String): Int = text.toByteArray(Charsets.UTF_8).size

    /** Compact JSON with sorted object keys, so equal values always digest equally. */
    fun canonical(value: Any?): String = when (value) {
        null, JSONObject.NULL -> "null"
        is JSONObject -> value.keys().asSequence().sorted()
            .joinToString(",", "{", "}") { JSONObject.quote(it) + ":" + canonical(value.opt(it)) }
        is JSONArray -> (0 until value.length()).joinToString(",", "[", "]") { canonical(value.opt(it)) }
        is String -> JSONObject.quote(value)
        is Number, is Boolean -> value.toString()
        else -> JSONObject.quote(value.toString())
    }

    fun sha256Hex(text: String): String =
        MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
}
