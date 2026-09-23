package com.colonelpanic.mova

import android.content.Context
import android.util.Base64
import com.colonelpanic.mova.intents.TemplateInfo
import com.colonelpanic.mova.intents.TodoRef
import com.colonelpanic.mova.intents.TodoSearch
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import org.json.JSONArray
import org.json.JSONObject

/**
 * How far a failed request got. Callers that must not repeat a write use this
 * to tell "nothing reached the server" from "the server may have applied it".
 */
enum class Delivery {
    /** Nothing was sent: local validation, missing login, or the connection never opened. */
    NOT_SENT,
    /** The server answered with a definitive error. */
    REJECTED,
    /** The request may have been processed but no definitive answer arrived. */
    UNCERTAIN,
}

sealed class ApiResult<out T> {
    data class Ok<T>(val value: T) : ApiResult<T>()
    data class Err(
        val message: String,
        val httpStatus: Int? = null,
        val delivery: Delivery = Delivery.NOT_SENT,
        /** The caller's time budget ran out, before sending or while waiting. */
        val deadlineExceeded: Boolean = false,
        /** The request itself is invalid (bad template, missing prompt); nothing was sent. */
        val invalid: Boolean = false,
    ) : ApiResult<Nothing>()

    inline fun <R> map(transform: (T) -> R): ApiResult<R> = when (this) {
        is Ok -> Ok(transform(value))
        is Err -> this
    }
}

/**
 * Minimal org-agenda-api client for native surfaces (widgets, intents, the
 * content provider). Uses the credentials the React Native app stores for the
 * active server in [MovaSharedPrefs]; there is no offline queue here.
 *
 * [remainingMillis], when set, bounds every request by the caller's remaining
 * budget. Writes are never retried: a POST uses a fresh connection and a fixed
 * length body, so a failure is classified by whether any of it left the device.
 */
class MovaClient(
    private val apiUrl: String,
    private val username: String,
    private val password: String,
    private val remainingMillis: (() -> Long)? = null,
) {

    data class TodoList(val todos: List<JSONObject>, val total: Int)

    companion object {
        const val PREF_API_URL = "mova_api_url"
        const val PREF_USERNAME = "mova_username"
        const val PREF_PASSWORD = "mova_password"
        const val PREF_DEFAULT_TEMPLATE = "mova_default_template"
        const val NOT_LOGGED_IN = "Log in to Mova first"
        private const val CONNECT_TIMEOUT_MILLIS = 8000
        private const val READ_TIMEOUT_MILLIS = 15000
        private const val MIN_REQUEST_MILLIS = 500L

        fun fromPrefs(context: Context): MovaClient? {
            val prefs = MovaSharedPrefs.get(context)
            val apiUrl = prefs.getString(PREF_API_URL, null) ?: return null
            val username = prefs.getString(PREF_USERNAME, null) ?: return null
            val password = prefs.getString(PREF_PASSWORD, null) ?: return null
            return MovaClient(apiUrl.trimEnd('/'), username, password)
        }

        /**
         * A 5xx may arrive after the server already changed an org file, so it
         * is uncertain; any other answered error is a definitive rejection.
         */
        internal fun classify(status: Int, text: String): ApiResult<JSONObject> {
            val json = try {
                if (text.isBlank()) JSONObject() else JSONObject(text)
            } catch (e: Exception) {
                null
            }
            val message = json?.optString("message")?.takeIf { it.isNotEmpty() }
            return when {
                status == 401 -> ApiResult.Err("Authentication failed", status, Delivery.REJECTED)
                status >= 500 -> ApiResult.Err(message ?: "Server error $status", status, Delivery.UNCERTAIN)
                status !in 200..299 -> ApiResult.Err(message ?: "Server error $status", status, Delivery.REJECTED)
                json == null -> ApiResult.Err("Unexpected response from server", status, Delivery.UNCERTAIN)
                json.optString("status") == "error" ->
                    ApiResult.Err(message ?: "Request failed", status, Delivery.REJECTED)
                else -> ApiResult.Ok(json)
            }
        }

        fun defaultTemplate(context: Context): String =
            MovaSharedPrefs.get(context).getString(PREF_DEFAULT_TEMPLATE, null)
                ?.takeIf { it.isNotEmpty() } ?: "default"
    }

    fun withDeadline(remainingMillis: () -> Long): MovaClient =
        MovaClient(apiUrl, username, password, remainingMillis)

    /** Identifies the server account without revealing the password. */
    val accountKey: String get() = "$apiUrl\n$username"

    fun getTemplates(): ApiResult<Map<String, TemplateInfo>> =
        get("/capture-templates").map { json ->
            json.keys().asSequence().associateWith { key ->
                TemplateInfo.fromJson(key, json.getJSONObject(key))
            }
        }

    fun capture(template: String, values: JSONObject): ApiResult<JSONObject> =
        post("/capture", JSONObject().put("template", template).put("values", values))

    fun complete(ref: TodoRef, state: String, overrideDate: String?, strict: Boolean): ApiResult<JSONObject> {
        val body = JSONObject()
        ref.writeTo(body)
        body.put("state", state)
        overrideDate?.let { body.put("override_date", it) }
        return postStrict("/complete", body, strict)
    }

    fun update(ref: TodoRef, updates: JSONObject, strict: Boolean): ApiResult<JSONObject> {
        val body = JSONObject()
        ref.writeTo(body)
        for (key in updates.keys()) body.put(key, updates.get(key))
        return postStrict("/update", body, strict)
    }

    /**
     * Servers older than org-agenda-api's strict lookup reject the unknown
     * `strict` field while validating, before touching any file, so resending
     * without it cannot repeat a write. They then match by file and title.
     */
    private fun postStrict(path: String, body: JSONObject, strict: Boolean): ApiResult<JSONObject> {
        if (!strict) return post(path, body)
        val result = post(path, JSONObject(body.toString()).put("strict", true))
        val unsupported = result is ApiResult.Err && result.delivery == Delivery.REJECTED &&
            result.message.contains("Unrecognized fields") && result.message.contains("strict")
        return if (unsupported) post(path, body) else result
    }

    fun delete(ref: TodoRef): ApiResult<JSONObject> {
        val body = JSONObject()
        ref.id?.let { body.put("id", it) }
        ref.file?.let { body.put("file", it) }
        ref.pos?.let { body.put("pos", it) }
        body.put("include_children", true)
        return post("/delete", body)
    }

    /**
     * GET /get-all-todos. Servers that support `q`/`limit` answer with a
     * `total`; older servers ignore both, so filtering and ranking run locally.
     */
    fun getAllTodos(query: String? = null, limit: Int? = null, refresh: Boolean = false): ApiResult<TodoList> {
        val params = mutableListOf<Pair<String, String>>()
        query?.takeIf { it.isNotEmpty() }?.let { params.add("q" to it) }
        limit?.let { params.add("limit" to it.toString()) }
        if (refresh) params.add("refresh" to "true")
        return get("/get-all-todos", params).map { json ->
            val todos = TodoSearch.toList(json.optJSONArray("todos") ?: JSONArray())
            if (json.has("total")) {
                TodoList(todos, json.getInt("total"))
            } else {
                val result = TodoSearch.search(todos, query, limit)
                TodoList(result.todos, result.total)
            }
        }
    }

    fun findTodo(ref: TodoRef): ApiResult<JSONObject?> =
        getAllTodos().map { list ->
            list.todos.firstOrNull { todo ->
                when {
                    ref.id != null -> todo.optString("id", "") == ref.id
                    ref.file != null && ref.pos != null ->
                        todo.optString("file", "") == ref.file && todo.optInt("pos", -1) == ref.pos
                    ref.title != null -> todo.optString("title", "") == ref.title
                    else -> false
                }
            }
        }

    fun getAgenda(
        date: String?,
        span: String,
        includeOverdue: Boolean?,
        includeCompleted: Boolean?,
        refresh: Boolean = false,
    ): ApiResult<JSONObject> {
        val params = mutableListOf("span" to span)
        date?.let { params.add("date" to it) }
        includeOverdue?.let { params.add("include_overdue" to it.toString()) }
        includeCompleted?.let { params.add("include_completed" to it.toString()) }
        if (refresh) params.add("refresh" to "true")
        return get("/agenda", params)
    }

    private fun get(path: String, params: List<Pair<String, String>> = emptyList()): ApiResult<JSONObject> {
        val query = params.joinToString("&") { (k, v) ->
            URLEncoder.encode(k, "UTF-8") + "=" + URLEncoder.encode(v, "UTF-8")
        }
        val url = if (query.isEmpty()) "$apiUrl$path" else "$apiUrl$path?$query"
        return request(url, "GET", null)
    }

    private fun post(path: String, body: JSONObject): ApiResult<JSONObject> =
        request("$apiUrl$path", "POST", body.toString())

    private fun request(url: String, method: String, body: String?): ApiResult<JSONObject> {
        val budget = remainingMillis?.invoke()
        if (budget != null && budget < MIN_REQUEST_MILLIS) {
            return ApiResult.Err("Ran out of time before contacting the server", deadlineExceeded = true)
        }
        val connectTimeout = budget?.let { minOf(CONNECT_TIMEOUT_MILLIS.toLong(), it / 2).toInt() } ?: CONNECT_TIMEOUT_MILLIS
        val readTimeout = budget?.let { maxOf(1L, it - connectTimeout).toInt() } ?: READ_TIMEOUT_MILLIS
        val payload = body?.toByteArray()
        var sent = false
        val connection = try {
            URL(url).openConnection() as HttpURLConnection
        } catch (e: Exception) {
            return ApiResult.Err("Network error: ${e.message}")
        }
        return try {
            connection.connectTimeout = connectTimeout
            connection.readTimeout = readTimeout
            connection.requestMethod = method
            connection.setRequestProperty("Authorization", basicAuth())
            connection.setRequestProperty("Accept", "application/json")
            if (payload != null) {
                connection.setRequestProperty("Content-Type", "application/json")
                // A pooled keep-alive socket can be silently dead; a fresh one
                // keeps "could not connect" distinct from "sent, then lost".
                connection.setRequestProperty("Connection", "close")
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(payload.size)
            }
            connection.connect()
            sent = true
            payload?.let { bytes -> connection.outputStream.use { it.write(bytes) } }
            val status = connection.responseCode
            val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.readText().orEmpty()
            classify(status, text)
        } catch (e: java.net.SocketTimeoutException) {
            // A timeout counts as the caller's deadline when the budget, not the default, set it.
            if (sent) {
                ApiResult.Err(
                    "No response from the server in time",
                    delivery = Delivery.UNCERTAIN,
                    deadlineExceeded = readTimeout < READ_TIMEOUT_MILLIS,
                )
            } else {
                ApiResult.Err("Could not reach the server in time", deadlineExceeded = connectTimeout < CONNECT_TIMEOUT_MILLIS)
            }
        } catch (e: Exception) {
            ApiResult.Err("Network error: ${e.message}", delivery = if (sent) Delivery.UNCERTAIN else Delivery.NOT_SENT)
        } finally {
            connection.disconnect()
        }
    }

    private fun basicAuth(): String =
        "Basic " + Base64.encodeToString("$username:$password".toByteArray(), Base64.NO_WRAP)
}
