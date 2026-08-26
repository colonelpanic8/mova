package com.colonelpanic.mova.pins

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

private const val PREFS_NAME = "mova_pins"
private const val KEY_PINS = "pins"
private const val KEY_DEFAULT_REMINDER_MINUTES = "default_reminder_minutes"
private const val DEFAULT_REMINDER_MINUTES = 15

/**
 * A "pin": an ephemeral don't-forget reminder held open as a persistent
 * notification until explicitly completed.
 *
 * @param escalateAt epoch millis at which the pin starts actively alerting,
 *   or 0 for a purely passive pin.
 * @param escalated whether the escalation deadline has fired; escalated pins
 *   nag on the high-priority channel until completed or snoozed.
 */
data class Pin(
  val id: String,
  val title: String,
  val createdAt: Long,
  val escalateAt: Long,
  val escalated: Boolean,
) {
  fun toJson(): JSONObject =
    JSONObject()
      .put("id", id)
      .put("title", title)
      .put("createdAt", createdAt)
      .put("escalateAt", escalateAt)
      .put("escalated", escalated)

  companion object {
    fun fromJson(json: JSONObject): Pin? {
      val id = json.optString("id")
      val title = json.optString("title")
      if (id.isBlank() || title.isBlank()) return null
      return Pin(
        id = id,
        title = title,
        createdAt = json.optLong("createdAt"),
        escalateAt = json.optLong("escalateAt"),
        escalated = json.optBoolean("escalated"),
      )
    }
  }
}

object PinStore {
  fun list(context: Context): List<Pin> {
    val raw = prefs(context).getString(KEY_PINS, null) ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).mapNotNull { index ->
        array.optJSONObject(index)?.let { Pin.fromJson(it) }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  fun get(context: Context, id: String): Pin? =
    list(context).firstOrNull { it.id == id }

  fun upsert(context: Context, pin: Pin) {
    save(context, list(context).filter { it.id != pin.id } + pin)
  }

  fun remove(context: Context, id: String) {
    save(context, list(context).filter { it.id != id })
  }

  fun getDefaultReminderMinutes(context: Context): Int =
    prefs(context).getInt(KEY_DEFAULT_REMINDER_MINUTES, DEFAULT_REMINDER_MINUTES)

  fun setDefaultReminderMinutes(context: Context, minutes: Int) {
    prefs(context).edit().putInt(KEY_DEFAULT_REMINDER_MINUTES, minutes).apply()
  }

  private fun save(context: Context, pins: List<Pin>) {
    val array = JSONArray()
    pins.forEach { array.put(it.toJson()) }
    prefs(context).edit().putString(KEY_PINS, array.toString()).apply()
  }

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
