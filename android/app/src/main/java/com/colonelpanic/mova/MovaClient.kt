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

sealed class ApiResult<out T> {
    data class Ok<T>(val value: T) : ApiResult<T>()
    data class Err(val message: String, val httpStatus: Int? = null) : ApiResult<Nothing>()

    inline fun <R> map(transform: (T) -> R): ApiResult<R> = when (this) {
        is Ok -> Ok(transform(value))
        is Err -> this
    }
}

/**
 * Minimal org-agenda-api client for native surfaces (widgets, intents, the
 * content provider). Uses the credentials the React Native app stores for the
 * active server in [MovaSharedPrefs]; there is no offline queue here.
 */
class MovaClient(private val apiUrl: String, private val username: String, private val password: String) {

    data class TodoList(val todos: List<JSONObject>, val total: Int)

    companion object {
        const val PREF_API_URL = "mova_api_url"
        const val PREF_USERNAME = "mova_username"
        const val PREF_PASSWORD = "mova_password"
        const val PREF_DEFAULT_TEMPLATE = "mova_default_template"
        const val NOT_LOGGED_IN = "Log in to Mova first"

        fun fromPrefs(context: Context): MovaClient? {
            val prefs = MovaSharedPrefs.get(context)
            val apiUrl = prefs.getString(PREF_API_URL, null) ?: return null
            val username = prefs.getString(PREF_USERNAME, null) ?: return null
            val password = prefs.getString(PREF_PASSWORD, null) ?: return null
            return MovaClient(apiUrl.trimEnd('/'), username, password)
        }

        fun defaultTemplate(context: Context): String =
            MovaSharedPrefs.get(context).getString(PREF_DEFAULT_TEMPLATE, null)
                ?.takeIf { it.isNotEmpty() } ?: "default"
    }

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
        if (strict) body.put("strict", true)
        return post("/complete", body)
    }

    fun update(ref: TodoRef, updates: JSONObject, strict: Boolean): ApiResult<JSONObject> {
        val body = JSONObject()
        ref.writeTo(body)
        for (key in updates.keys()) body.put(key, updates.get(key))
        if (strict) body.put("strict", true)
        return post("/update", body)
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
        return try {
            val connection = URL(url).openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 8000
                connection.readTimeout = 15000
                connection.requestMethod = method
                connection.setRequestProperty("Authorization", basicAuth())
                connection.setRequestProperty("Accept", "application/json")
                if (body != null) {
                    connection.setRequestProperty("Content-Type", "application/json")
                    connection.doOutput = true
                    connection.outputStream.use { it.write(body.toByteArray()) }
                }
                val status = connection.responseCode
                val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()?.readText().orEmpty()
                val json = try {
                    if (text.isBlank()) JSONObject() else JSONObject(text)
                } catch (e: Exception) {
                    null
                }
                when {
                    status == 401 -> ApiResult.Err("Authentication failed", status)
                    status !in 200..299 -> ApiResult.Err(
                        json?.optString("message")?.takeIf { it.isNotEmpty() } ?: "Server error $status",
                        status,
                    )
                    json == null -> ApiResult.Err("Unexpected response from server", status)
                    json.optString("status") == "error" ->
                        ApiResult.Err(json.optString("message").ifEmpty { "Request failed" }, status)
                    else -> ApiResult.Ok(json)
                }
            } finally {
                connection.disconnect()
            }
        } catch (e: Exception) {
            ApiResult.Err("Network error: ${e.message}")
        }
    }

    private fun basicAuth(): String =
        "Basic " + Base64.encodeToString("$username:$password".toByteArray(), Base64.NO_WRAP)
}
