package com.colonelpanic.mova.wear

import android.util.Base64
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class CaptureResult(
  val success: Boolean,
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

  private fun WearCredentials.authHeader(): String {
    val token = "$username:$password"
    return "Basic " + Base64.encodeToString(token.toByteArray(), Base64.NO_WRAP)
  }
}
