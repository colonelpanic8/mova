package com.colonelpanic.mova.appfunctions

import android.content.Context
import android.util.Base64
import androidx.appfunctions.AppFunctionAppUnknownException
import androidx.appfunctions.AppFunctionContext
import androidx.appfunctions.AppFunctionInvalidArgumentException
import androidx.appfunctions.AppFunctionSerializable
import androidx.appfunctions.service.AppFunction
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Result of a [MovaAppFunctions.createTodo] call.
 *
 * @property success True when the todo was accepted by the org-agenda-api server.
 * @property message A short, human-readable confirmation suitable for reading back to the user.
 */
@AppFunctionSerializable(isDescribedByKDoc = true)
data class CreateTodoResult(
    /** True when the todo was captured on the server. */
    val success: Boolean,
    /** A short, human-readable confirmation of what happened. */
    val message: String,
)

/**
 * AppFunctions exposed by Mova, the org-mode agenda client.
 *
 * Instances are created by the androidx.appfunctions runtime through the
 * `AppFunctionConfiguration.Provider` registered in `MainApplication`. Each `@AppFunction`
 * method here is indexed by the OS and made callable by on-device assistants/agents (eventually
 * Gemini). The KDoc on each method is what the model sees as the tool description, so it is
 * written as an agent-facing tool spec.
 */
class MovaAppFunctions {

    /**
     * Capture a new todo/task into the user's org-mode inbox.
     *
     * Use this whenever the user wants to remember, jot down, add, or capture a task, todo,
     * reminder, or note into Mova / their org agenda (for example: "add milk to my todos",
     * "remind me to call the dentist", "capture a task to file taxes"). The todo is sent to
     * the user's self-hosted org-agenda-api server using the "default" capture template and
     * appears in their agenda immediately.
     *
     * The user must already be signed in to the Mova app; this function reuses the server URL
     * and credentials that Mova stored at login. It does not prompt for or accept credentials.
     *
     * @param appFunctionContext Execution context supplied by the AppFunctions runtime. Used to
     *   read Mova's stored server URL and credentials.
     * @param title The task text / headline of the todo, e.g. "Buy milk" or "Call the dentist".
     *   This becomes the org headline. Required and must not be blank.
     * @param notes Optional longer free-form details or body text for the todo. Pass null or
     *   omit when the user only gave a short task. When provided it is stored as the todo's
     *   body/notes.
     * @return A [CreateTodoResult] describing whether the capture succeeded and a message that
     *   can be read back to the user.
     * @throws AppFunctionInvalidArgumentException If [title] is blank. If thrown, ask the user
     *   what the task should say.
     * @throws AppFunctionAppUnknownException If Mova has no stored credentials (the user is not
     *   signed in) or if the server could not be reached. If thrown for a network error, suggest
     *   the user check their connection and retry; if thrown because the user is not signed in,
     *   ask them to open Mova and log in first.
     */
    @AppFunction(isDescribedByKDoc = true)
    suspend fun createTodo(
        appFunctionContext: AppFunctionContext,
        title: String,
        notes: String? = null,
    ): CreateTodoResult {
        val trimmedTitle = title.trim()
        if (trimmedTitle.isEmpty()) {
            throw AppFunctionInvalidArgumentException(
                "The todo title cannot be empty. Ask the user what the task should say.",
            )
        }

        val prefs = appFunctionContext.context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val apiUrl = prefs.getString(KEY_API_URL, null)?.trimEnd('/')
        val username = prefs.getString(KEY_USERNAME, null)
        val password = prefs.getString(KEY_PASSWORD, null)

        if (apiUrl.isNullOrBlank() || username.isNullOrBlank() || password.isNullOrBlank()) {
            throw AppFunctionAppUnknownException(
                "You are not signed in to Mova. Open the Mova app and log in, then try again.",
            )
        }

        return withContext(Dispatchers.IO) {
            postCapture(apiUrl, username, password, trimmedTitle, notes?.trim())
        }
    }

    private fun postCapture(
        apiUrl: String,
        username: String,
        password: String,
        title: String,
        notes: String?,
    ): CreateTodoResult {
        val connection = try {
            URL("$apiUrl/capture").openConnection() as HttpURLConnection
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw AppFunctionAppUnknownException(
                "Could not reach the Mova server: ${e.message}",
            )
        }

        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.setRequestProperty("Content-Type", "application/json")
            val basicAuth = "Basic " + Base64.encodeToString(
                "$username:$password".toByteArray(),
                Base64.NO_WRAP,
            )
            connection.setRequestProperty("Authorization", basicAuth)
            connection.doOutput = true

            val values = JSONObject().apply {
                put("Title", title)
                if (!notes.isNullOrBlank()) {
                    put("Body", notes)
                }
            }
            val body = JSONObject().apply {
                put("template", "default")
                put("values", values)
            }.toString()

            connection.outputStream.use { it.write(body.toByteArray()) }

            val responseCode = connection.responseCode
            return when {
                responseCode in 200..299 ->
                    CreateTodoResult(true, "Captured \"$title\" to your Mova todos.")
                responseCode == 401 ->
                    throw AppFunctionAppUnknownException(
                        "Mova rejected your saved credentials. Open the Mova app and log in again.",
                    )
                else -> {
                    val errorBody = try {
                        connection.errorStream?.bufferedReader()?.readText()
                    } catch (e: Exception) {
                        null
                    }
                    throw AppFunctionAppUnknownException(
                        "The Mova server returned an error ($responseCode)" +
                            (if (!errorBody.isNullOrBlank()) ": $errorBody" else "."),
                    )
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: AppFunctionAppUnknownException) {
            throw e
        } catch (e: Exception) {
            throw AppFunctionAppUnknownException(
                "Failed to capture the todo: ${e.message}",
            )
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        // Mirrors the credential storage written by the RN app at login
        // (widgets/storage.ts -> SharedStorageModule "mova_widget_prefs") and read natively
        // by QuickCaptureActivity. Keep these keys in sync with those.
        const val PREFS_NAME = "mova_widget_prefs"
        const val KEY_API_URL = "mova_api_url"
        const val KEY_USERNAME = "mova_username"
        const val KEY_PASSWORD = "mova_password"

        const val CONNECT_TIMEOUT_MS = 8_000
        const val READ_TIMEOUT_MS = 12_000
    }
}
