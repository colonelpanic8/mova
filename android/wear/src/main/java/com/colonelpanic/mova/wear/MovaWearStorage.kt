package com.colonelpanic.mova.wear

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

private const val PREFS_NAME = "mova_wear_prefs"
private const val KEY_API_URL = "mova_api_url"
private const val KEY_USERNAME = "mova_username"
private const val KEY_PASSWORD = "mova_password"
private const val KEY_PENDING_TODOS = "mova_pending_todos"

data class WearCredentials(
  val apiUrl: String,
  val username: String,
  val password: String,
)

data class PendingTodo(
  val text: String,
  val timestamp: Long,
)

object MovaWearStorage {
  fun saveCredentials(
    context: Context,
    apiUrl: String,
    username: String,
    password: String,
  ) {
    prefs(context).edit()
      .putString(KEY_API_URL, apiUrl)
      .putString(KEY_USERNAME, username)
      .putString(KEY_PASSWORD, password)
      .apply()
  }

  fun clearCredentials(context: Context) {
    prefs(context).edit()
      .remove(KEY_API_URL)
      .remove(KEY_USERNAME)
      .remove(KEY_PASSWORD)
      .apply()
  }

  fun getCredentials(context: Context): WearCredentials? {
    val prefs = prefs(context)
    val apiUrl = prefs.getString(KEY_API_URL, null)
    val username = prefs.getString(KEY_USERNAME, null)
    val password = prefs.getString(KEY_PASSWORD, null)

    return if (!apiUrl.isNullOrBlank() && !username.isNullOrBlank() && password != null) {
      WearCredentials(apiUrl, username, password)
    } else {
      null
    }
  }

  fun queueTodo(context: Context, text: String) {
    val pending = getPendingTodos(context).toMutableList()
    pending.add(PendingTodo(text, System.currentTimeMillis()))
    savePendingTodos(context, pending)
  }

  fun getPendingTodos(context: Context): List<PendingTodo> {
    val raw = prefs(context).getString(KEY_PENDING_TODOS, null) ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).mapNotNull { index ->
        val item = array.optJSONObject(index) ?: return@mapNotNull null
        val text = item.optString("text", "")
        val timestamp = item.optLong("timestamp", 0L)
        if (text.isBlank() || timestamp == 0L) {
          null
        } else {
          PendingTodo(text, timestamp)
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  fun removePendingTodo(context: Context, timestamp: Long) {
    savePendingTodos(
      context,
      getPendingTodos(context).filter { it.timestamp != timestamp },
    )
  }

  private fun savePendingTodos(context: Context, todos: List<PendingTodo>) {
    val array = JSONArray()
    todos.forEach { todo ->
      array.put(
        JSONObject()
          .put("text", todo.text)
          .put("timestamp", todo.timestamp),
      )
    }
    prefs(context).edit()
      .putString(KEY_PENDING_TODOS, array.toString())
      .apply()
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
