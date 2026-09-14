package com.colonelpanic.mova.intents

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class TodoSearchTest {

    private fun todo(title: String, state: String = "TODO", tags: List<String>? = null, category: String? = null) =
        JSONObject().apply {
            put("title", title)
            put("todo", state)
            put("tags", tags?.let { JSONArray(it) } ?: JSONObject.NULL)
            put("effectiveCategory", category ?: JSONObject.NULL)
        }

    private val todos = listOf(
        todo("Call the bank", tags = listOf("phone")),
        todo("Bank statement", category = "finance"),
        todo("bank", state = "NEXT"),
        todo("Groceries", tags = listOf("Bank-run")),
        todo("Unrelated", category = "misc"),
        todo("Waiting on plumber", state = "WAITING"),
    )

    @Test
    fun ranksExactTitleThenPrefixThenOtherMatchesInOriginalOrder() {
        val result = TodoSearch.filterAndRank(todos, "BANK").map { it.getString("title") }
        assertEquals(listOf("bank", "Bank statement", "Call the bank", "Groceries"), result)
    }

    @Test
    fun matchesStateAndCategory() {
        assertEquals(listOf("Waiting on plumber"), TodoSearch.filterAndRank(todos, "waiting").map { it.getString("title") })
        assertEquals(listOf("Bank statement"), TodoSearch.filterAndRank(todos, "finance").map { it.getString("title") })
    }

    @Test
    fun emptyQueryReturnsEverythingAndLimitReportsTotal() {
        assertEquals(todos, TodoSearch.filterAndRank(todos, null))
        val result = TodoSearch.search(todos, "bank", limit = 2)
        assertEquals(4, result.total)
        assertEquals(listOf("bank", "Bank statement"), result.todos.map { it.getString("title") })
    }
}
