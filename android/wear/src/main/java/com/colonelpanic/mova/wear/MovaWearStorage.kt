package com.colonelpanic.mova.wear

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject

private const val TAG = "MovaWearStorage"
private const val LEGACY_PREFS_NAME = "mova_wear_prefs"
private const val PREFS_NAME = "mova_wear_prefs_secure"
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

  @Volatile
  private var cachedPrefs: SharedPreferences? = null

  /**
   * EncryptedSharedPreferences backed by an Android Keystore master key. On
   * first access any values found in the legacy plaintext "mova_wear_prefs"
   * file are migrated into the encrypted store and the plaintext file is
   * cleared.
   */
  private fun prefs(context: Context): SharedPreferences {
    return cachedPrefs ?: synchronized(this) {
      cachedPrefs ?: run {
        val appContext = context.applicationContext
        val encrypted = createEncrypted(appContext)
        migrateLegacy(appContext, encrypted)
        encrypted.also { cachedPrefs = it }
      }
    }
  }

  private fun createEncrypted(context: Context): SharedPreferences {
    return try {
      buildEncrypted(context)
    } catch (e: Exception) {
      // The encrypted file can become unreadable if the keystore entry is
      // lost. Reset the store rather than permanently crashing the app.
      Log.w(TAG, "Encrypted prefs unreadable, resetting store", e)
      context.deleteSharedPreferences(PREFS_NAME)
      buildEncrypted(context)
    }
  }

  private fun buildEncrypted(context: Context): SharedPreferences {
    val masterKey = MasterKey.Builder(context)
      .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
      .build()
    return EncryptedSharedPreferences.create(
      context,
      PREFS_NAME,
      masterKey,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )
  }

  private fun migrateLegacy(context: Context, encrypted: SharedPreferences) {
    val legacy = context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
    val entries = legacy.all
    if (entries.isEmpty()) {
      return
    }

    val editor = encrypted.edit()
    for ((key, value) in entries) {
      when (value) {
        is String -> editor.putString(key, value)
        is Boolean -> editor.putBoolean(key, value)
        is Int -> editor.putInt(key, value)
        is Long -> editor.putLong(key, value)
        is Float -> editor.putFloat(key, value)
        is Set<*> -> @Suppress("UNCHECKED_CAST") editor.putStringSet(key, value as Set<String>)
      }
    }
    if (editor.commit()) {
      legacy.edit().clear().commit()
      Log.i(TAG, "Migrated ${entries.size} entries from plaintext prefs to encrypted storage")
    } else {
      Log.w(TAG, "Failed to migrate legacy prefs to encrypted storage; keeping legacy file")
    }
  }
}
