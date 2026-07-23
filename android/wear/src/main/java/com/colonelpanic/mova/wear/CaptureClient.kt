package com.colonelpanic.mova.wear

import android.util.Base64
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class CaptureResult(
  val success: Boolean,
  val message: String,
)

data class CustomViewEntry(
  val title: String,
  val detail: String,
)

data class CustomViewResult(
  val success: Boolean,
  val name: String?,
  val entries: List<CustomViewEntry>,
  val message: String,
)

object CaptureClient {
  fun capture(credentials: WearCredentials, text: String): CaptureResult {
    val connection = try {
      URL("${credentials.apiUrl}/capture").openConnection() as HttpURLConnection
    } catch (error: Exception) {
      return CaptureResult(false, "Invalid server URL")
    }

    return try {
      connection.requestMethod = "POST"
      connection.connectTimeout = 8000
      connection.readTimeout = 12000
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("Authorization", credentials.authHeader())

      val body = JSONObject()
        .put("template", "default")
        .put(
          "values",
          JSONObject().put("Title", text),
        )
        .toString()

      connection.outputStream.use { stream ->
        stream.write(body.toByteArray(Charsets.UTF_8))
      }

      when (val responseCode = connection.responseCode) {
        in 200..299 -> CaptureResult(true, "Captured")
        401 -> CaptureResult(false, "Authentication failed")
        else -> CaptureResult(false, "Server error $responseCode")
      }
    } catch (error: Exception) {
      CaptureResult(false, "Network error")
    } finally {
      connection.disconnect()
    }
  }

  fun getCustomView(
    credentials: WearCredentials,
    customView: WearCustomView,
  ): CustomViewResult {
    val encodedKey = URLEncoder.encode(customView.key, Charsets.UTF_8.name())
    val connection = try {
      URL("${credentials.apiUrl}/custom-view?key=$encodedKey")
        .openConnection() as HttpURLConnection
    } catch (_: Exception) {
      return CustomViewResult(false, null, emptyList(), "Invalid server URL")
    }

    return try {
      connection.requestMethod = "GET"
      connection.connectTimeout = 8000
      connection.readTimeout = 12000
      connection.setRequestProperty("Accept", "application/json")
      connection.setRequestProperty("Authorization", credentials.authHeader())

      when (val responseCode = connection.responseCode) {
        in 200..299 -> {
          val response = connection.inputStream.bufferedReader().use { it.readText() }
          val json = JSONObject(response)
          val entriesJson = json.optJSONArray("entries")
          val entries = if (entriesJson == null) {
            emptyList()
          } else {
            (0 until entriesJson.length()).mapNotNull { index ->
              val entry = entriesJson.optJSONObject(index) ?: return@mapNotNull null
              val title = entry.optString("title").ifBlank {
                entry.optString("agendaLine")
              }
              if (title.isBlank()) {
                return@mapNotNull null
              }
              CustomViewEntry(
                title = title,
                detail = entry.optString("todo").takeIf { it.isNotBlank() } ?: "",
              )
            }
          }
          CustomViewResult(
            success = true,
            name = json.optString("name").takeIf { it.isNotBlank() },
            entries = entries,
            message = "Loaded",
          )
        }
        401 -> CustomViewResult(false, null, emptyList(), "Authentication failed")
        else -> CustomViewResult(false, null, emptyList(), "Server error $responseCode")
      }
    } catch (_: Exception) {
      CustomViewResult(false, null, emptyList(), "Network error")
    } finally {
      connection.disconnect()
    }
  }

  private fun WearCredentials.authHeader(): String {
    val token = "$username:$password"
    return "Basic " + Base64.encodeToString(token.toByteArray(), Base64.NO_WRAP)
  }
}
