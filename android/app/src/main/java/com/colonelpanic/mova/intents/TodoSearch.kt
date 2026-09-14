package com.colonelpanic.mova.intents

import org.json.JSONArray
import org.json.JSONObject

/**
 * Local equivalent of the server's `q`/`limit` handling on /get-all-todos, used
 * when the server predates search support (its response then carries no
 * `total` field). Mirrors the server: case-insensitive substring over title,
 * tags, todo state and category; exact title matches first, then title-prefix
 * matches, then the rest, each group in original order.
 */
object TodoSearch {

    data class Result(val todos: List<JSONObject>, val total: Int)

    fun filterAndRank(todos: List<JSONObject>, query: String?): List<JSONObject> {
        if (query.isNullOrEmpty()) return todos
        val needle = query.lowercase()
        val exact = mutableListOf<JSONObject>()
        val prefix = mutableListOf<JSONObject>()
        val rest = mutableListOf<JSONObject>()
        for (todo in todos) {
            if (searchFields(todo).none { it.lowercase().contains(needle) }) continue
            val title = todo.optString("title", "").lowercase()
            when {
                title == needle -> exact.add(todo)
                title.startsWith(needle) -> prefix.add(todo)
                else -> rest.add(todo)
            }
        }
        return exact + prefix + rest
    }

    fun search(todos: List<JSONObject>, query: String?, limit: Int?): Result {
        val matching = filterAndRank(todos, query)
        val returned = if (limit != null) matching.take(limit) else matching
        return Result(returned, matching.size)
    }

    fun toList(array: JSONArray): List<JSONObject> =
        (0 until array.length()).map { array.getJSONObject(it) }

    private fun searchFields(todo: JSONObject): List<String> {
        val fields = mutableListOf<String>()
        for (key in listOf("title", "todo", "category", "effectiveCategory")) {
            val value = todo.opt(key)
            if (value is String) fields.add(value)
        }
        when (val tags = todo.opt("tags")) {
            is JSONArray -> for (i in 0 until tags.length()) {
                val tag = tags.opt(i)
                if (tag is String) fields.add(tag)
            }
            is String -> fields.add(tags)
        }
        return fields
    }
}
