package com.colonelpanic.mova.intents

import android.content.ContentProvider
import android.content.ContentValues
import android.content.UriMatcher
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.Bundle
import android.util.Log
import com.colonelpanic.mova.ApiResult
import com.colonelpanic.mova.MovaClient
import org.json.JSONArray
import org.json.JSONObject

/**
 * Read-only view of the active server's todos for other apps, guarded by the
 * `com.colonelpanic.mova.permission.READ_TODOS` runtime permission.
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

    override fun insert(uri: Uri, values: ContentValues?): Uri? =
        throw UnsupportedOperationException("Use mova:// intents to change todos")

    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<String>?): Int =
        throw UnsupportedOperationException("Use mova:// intents to change todos")

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int =
        throw UnsupportedOperationException("Use mova:// intents to change todos")
}
