package com.colonelpanic.mova.intents

import android.content.ContentProvider
import android.content.ContentValues
import android.content.UriMatcher
import android.content.pm.PackageManager
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.Binder
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import com.colonelpanic.mova.ApiResult
import com.colonelpanic.mova.MovaClient
import com.colonelpanic.mova.MovaEvents
import com.colonelpanic.mova.eva.EvaExtensionService
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/**
 * The active server's todos for other apps. Queries need the
 * `com.colonelpanic.mova.permission.READ_TODOS` runtime permission; [call]
 * also runs writes for holders of `WRITE_TODOS`.
 *
 * - `content://com.colonelpanic.mova.provider/todos?q=&limit=`
 * - `content://com.colonelpanic.mova.provider/todos/<id>`
 * - `content://com.colonelpanic.mova.provider/agenda?date=&span=&include_overdue=&include_completed=`
 * - `content://com.colonelpanic.mova.provider/templates`
 *
 * Every query hits the server, so call it off the main thread.
 */
class TodoProvider : ContentProvider() {

    companion object {
        const val AUTHORITY = "com.colonelpanic.mova.provider"
        const val EXTRA_TOTAL = "total"
        const val READ_PERMISSION = "com.colonelpanic.mova.permission.READ_TODOS"
        const val WRITE_PERMISSION = "com.colonelpanic.mova.permission.WRITE_TODOS"
        const val METHOD_DESCRIBE = "describe"
        const val EXTRA_REQUEST_ID = "request_id"
        const val EXTRA_ARGUMENTS_JSON = "arguments_json"
        const val RESULT_STATUS = "status"
        const val RESULT_REASON_CODE = "reason_code"
        const val RESULT_STATE = "state"
        const val RESULT_MESSAGE = "message"
        const val RESULT_REQUEST_ID = "request_id"
        const val RESULT_JSON = "result_json"
        const val RESULT_CATALOG_JSON = "catalog_json"
        private const val TAG = "TodoProvider"
        private const val TODOS = 1
        private const val TODO_ID = 2
        private const val AGENDA = 3
        private const val TEMPLATES = 4

        private val matcher = UriMatcher(UriMatcher.NO_MATCH).apply {
            addURI(AUTHORITY, "todos", TODOS)
            addURI(AUTHORITY, "todos/*", TODO_ID)
            addURI(AUTHORITY, "agenda", AGENDA)
            addURI(AUTHORITY, "templates", TEMPLATES)
        }
    }

    override fun onCreate(): Boolean = true

    override fun getType(uri: Uri): String? = when (matcher.match(uri)) {
        TODOS, AGENDA -> "vnd.android.cursor.dir/vnd.$AUTHORITY.todo"
        TODO_ID -> "vnd.android.cursor.item/vnd.$AUTHORITY.todo"
        TEMPLATES -> "vnd.android.cursor.dir/vnd.$AUTHORITY.template"
        else -> null
    }

    override fun query(
        uri: Uri,
        projection: Array<String>?,
        selection: String?,
        selectionArgs: Array<String>?,
        sortOrder: String?,
    ): Cursor? {
        val context = context ?: return null
        val client = MovaClient.fromPrefs(context) ?: run {
            Log.w(TAG, "Query refused: no credentials stored (log in to Mova first)")
            return null
        }
        val match = matcher.match(uri)
        if (match == TEMPLATES) return queryTemplates(client, uri, projection)

        val result: ApiResult<Pair<List<JSONObject>, Int>> = when (match) {
            TODOS -> client.getAllTodos(
                query = uri.getQueryParameter("q"),
                limit = uri.getQueryParameter("limit")?.toIntOrNull()?.takeIf { it > 0 },
            ).map { it.todos to it.total }
            TODO_ID -> {
                val id = uri.lastPathSegment.orEmpty()
                client.findTodo(TodoRef(id = id)).map { found ->
                    val list = listOfNotNull(found)
                    list to list.size
                }
            }
            AGENDA -> client.getAgenda(
                date = uri.getQueryParameter("date"),
                span = uri.getQueryParameter("span")?.takeIf { it == "week" } ?: "day",
                includeOverdue = flag(uri, "include_overdue"),
                includeCompleted = flag(uri, "include_completed"),
            ).map { json ->
                val entries = TodoSearch.toList(json.optJSONArray("entries") ?: JSONArray())
                entries to entries.size
            }
            else -> throw IllegalArgumentException("Unknown URI $uri")
        }
        return when (result) {
            is ApiResult.Err -> {
                Log.w(TAG, "Query $uri failed: ${result.message}")
                null
            }
            is ApiResult.Ok -> {
                val (rows, total) = result.value
                val columns = projection ?: ProviderRows.ALL_COLUMNS
                MatrixCursor(columns, rows.size).also { cursor ->
                    rows.forEach { cursor.addRow(ProviderRows.row(it, columns)) }
                    cursor.extras = Bundle().apply { putInt(EXTRA_TOTAL, total) }
                }
            }
        }
    }

    private fun queryTemplates(
        client: MovaClient,
        uri: Uri,
        projection: Array<String>?,
    ): Cursor? = when (val result = client.getTemplates()) {
        is ApiResult.Err -> {
            Log.w(TAG, "Query $uri failed: ${result.message}")
            null
        }
        is ApiResult.Ok -> {
            val templates = result.value.values.toList()
            val columns = projection ?: TemplateProviderRows.ALL_COLUMNS
            val defaultTemplate = context?.let { MovaClient.defaultTemplate(it) }.orEmpty()
            MatrixCursor(columns, templates.size).also { cursor ->
                templates.forEach {
                    cursor.addRow(TemplateProviderRows.row(it, columns, defaultTemplate))
                }
                cursor.extras = Bundle().apply { putInt(EXTRA_TOTAL, templates.size) }
            }
        }
    }

    private fun flag(uri: Uri, name: String): Boolean? =
        uri.getQueryParameter(name)?.let { it == "true" || it == "1" }

    /**
     * Synchronous operations for other apps, with the same catalog, argument
     * rules and outcomes as the EVA extension (docs/intents.md). `method` is a
     * capability name, or `describe`. Reads need READ_TODOS, writes WRITE_TODOS.
     * Runs on the caller's binder thread and may block on the network for up
     * to 20 seconds, so call it off the main thread.
     */
    override fun call(method: String, arg: String?, extras: Bundle?): Bundle? {
        val context = context ?: return null
        val capabilities = EvaExtensionService.capabilities(context)
        if (method == METHOD_DESCRIBE) {
            if (!canRead() && !canWrite()) throw SecurityException("Requires $READ_PERMISSION or $WRITE_PERMISSION")
            return Bundle().apply { putString(RESULT_CATALOG_JSON, capabilities.catalog().toString()) }
        }
        if (!capabilities.has(method)) throw IllegalArgumentException("Unknown method '$method'")
        val write = capabilities.isWrite(method)
        if (write && !canWrite()) throw SecurityException("Requires $WRITE_PERMISSION")
        if (!write && !canRead()) throw SecurityException("Requires $READ_PERMISSION")

        val callerUid = Binder.getCallingUid()
        val requestId = extras?.getString(EXTRA_REQUEST_ID)
            ?.takeIf { it.length in 1..256 && it.all { c -> c in ' '..'~' } }
            ?: "anonymous-${UUID.randomUUID()}"
        val argumentsJson = extras?.getString(EXTRA_ARGUMENTS_JSON)
            ?: capabilities.schema(method)!!.coerce(argumentValues(extras)).toString()
        val execution = capabilities.execute(
            callerUid,
            requestId,
            null,
            method,
            argumentsJson,
            SystemClock.elapsedRealtime() + capabilities.maxWaitMillis(method),
        )
        if (execution.dataChanged) MovaEvents.dataChanged(context)
        return resultBundle(JSONObject(execution.envelope), requestId)
    }

    private fun canRead() = context?.checkCallingPermission(READ_PERMISSION) == PackageManager.PERMISSION_GRANTED

    private fun canWrite() = context?.checkCallingPermission(WRITE_PERMISSION) == PackageManager.PERMISSION_GRANTED

    private fun argumentValues(extras: Bundle?): Map<String, Any?> {
        if (extras == null) return emptyMap()
        return extras.keySet()
            .filter { it != EXTRA_REQUEST_ID }
            .associateWith { key ->
                @Suppress("DEPRECATION")
                when (val value = extras.get(key)) {
                    is Bundle -> value.keySet().associateWith { value.getString(it) }
                    else -> value
                }
            }
    }

    private fun resultBundle(envelope: JSONObject, requestId: String): Bundle = Bundle().apply {
        putString(RESULT_STATUS, envelope.getString("status"))
        if (!envelope.isNull("reasonCode")) putString(RESULT_REASON_CODE, envelope.getString("reasonCode"))
        putString(RESULT_MESSAGE, envelope.optJSONArray("content")?.optJSONObject(0)?.optString("text").orEmpty())
        putString(RESULT_REQUEST_ID, requestId)
        envelope.optJSONObject("structuredContent")?.let { structured ->
            structured.optString("state").takeIf { it.isNotEmpty() }?.let { putString(RESULT_STATE, it) }
            putString(RESULT_JSON, structured.toString())
        }
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? =
        throw UnsupportedOperationException("Use mova:// intents to change todos")

    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<String>?): Int =
        throw UnsupportedOperationException("Use mova:// intents to change todos")

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int =
        throw UnsupportedOperationException("Use mova:// intents to change todos")
}
