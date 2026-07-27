package com.colonelpanic.mova.wear

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * OpenAI function definitions and their local implementations.
 *
 * The generic API tool is intentionally allowlisted: model-generated paths
 * never become arbitrary network requests. Common workflows get dedicated
 * tools with clearer schemas, while the generic tool keeps less-common
 * org-agenda-api features available without another app release.
 */
internal object OrgAgendaAssistantTools {
  private const val MAX_SEARCH_RESULTS = 50
  private const val MAX_TOOL_OUTPUT_CHARS = 80_000

  private val getEndpoints = setOf(
    "/agenda",
    "/agenda-files",
    "/all-habit-statuses",
    "/categories",
    "/category-types",
    "/capture-templates",
    "/category-tasks",
    "/custom-view",
    "/custom-views",
    "/filter-options",
    "/get-all-todos",
    "/get-todays-agenda",
    "/habit-config",
    "/habit-status",
    "/health",
    "/metadata",
    "/notifications",
    "/todo-states",
    "/todo-states-by-file",
    "/version",
  )

  private val postEndpoints = setOf(
    "/add-clock",
    "/call-function",
    "/delete-clock",
    "/delete-logbook-entry",
    "/trigger-sync",
    "/update-clock",
  )

  fun definitions(): JSONArray = JSONArray()
    .put(
      functionTool(
        name = "search_todos",
        description = """
          Search and count todos without sending the entire org database to the model.
          Use this before mutating a task so you have its id or exact file and pos.
          created_date matches common CREATED/CREATED_AT/DATE_CREATED properties.
        """.trimIndent(),
        properties = JSONObject()
          .put("query", stringProperty("Text matched against title, tags, category, outline path, and properties."))
          .put("state", stringProperty("Optional exact TODO state."))
          .put("created_date", stringProperty("Optional local date in YYYY-MM-DD."))
          .put("include_archives", booleanProperty("Whether to include archive files."))
          .put("max_results", integerProperty("Maximum matching todos to return (1-50); count is always total matches.")),
      ),
    )
    .put(
      functionTool(
        name = "get_agenda",
        description = "Get agenda entries for one local date, optionally including overdue or completed entries.",
        properties = JSONObject()
          .put("date", stringProperty("Date in YYYY-MM-DD. Omit for the server's today."))
          .put("include_overdue", booleanProperty("Include overdue entries."))
          .put("include_completed", booleanProperty("Include entries completed on the requested date.")),
      ),
    )
    .put(
      functionTool(
        name = "get_habits",
        description = "Get every configured window habit, its ID, completion dates, and status graph.",
        properties = JSONObject()
          .put("preceding", integerProperty("Number of preceding intervals to include."))
          .put("following", integerProperty("Number of following days to include.")),
      ),
    )
    .put(
      functionTool(
        name = "capture_todo",
        description = "Create a todo with a registered capture template. Use get metadata first when the template fields are unknown.",
        properties = JSONObject()
          .put("template", stringProperty("Capture template key, usually default."))
          .put("values", objectProperty("Template prompt names mapped to their values.")),
        required = listOf("template", "values"),
      ),
    )
    .put(
      functionTool(
        name = "capture_category_todo",
        description = "Create a todo with a configured category capture strategy. Use metadata and categories first.",
        properties = JSONObject()
          .put("type", stringProperty("Category strategy type."))
          .put("category", stringProperty("Configured category name."))
          .put("title", stringProperty("Todo title."))
          .put("values", objectProperty("Additional configured capture values.")),
        required = listOf("type", "category", "title"),
      ),
    )
    .put(
      functionTool(
        name = "update_todo",
        description = "Update an existing todo. Identify it by id, or by both file and pos. Only include fields that should change.",
        properties = todoIdentifierProperties()
          .put("new_title", stringProperty("Replacement title."))
          .put("state", stringProperty("Replacement TODO state."))
          .put("scheduled", nullableObjectProperty("Scheduled timestamp object, or null to clear."))
          .put("deadline", nullableObjectProperty("Deadline timestamp object, or null to clear."))
          .put("priority", nullableStringProperty("Priority, or null to clear."))
          .put("body", nullableStringProperty("Org body text, or null to clear."))
          .put("properties", nullableObjectProperty("Org property name/value pairs."))
          .put("tags", nullableArrayProperty("Tag strings, or null to clear."))
          .put("effort", nullableStringProperty("Org effort value, or null to clear.")),
      ),
    )
    .put(
      functionTool(
        name = "complete_todo",
        description = """
          Set a todo or habit to a done state. Identify it by id, or by both file
          and pos. Set override_date for historical habit completion, such as yesterday.
        """.trimIndent(),
        properties = todoIdentifierProperties()
          .put("state", stringProperty("Done state. Use metadata/todo-states when unsure; defaults to DONE."))
          .put("override_date", stringProperty("Optional completion date in YYYY-MM-DD.")),
      ),
    )
    .put(
      functionTool(
        name = "delete_todo",
        description = "Permanently delete a todo and its children. Call only when the user's current request explicitly asks to delete it.",
        properties = todoIdentifierProperties(),
      ),
    )
    .put(
      functionTool(
        name = "call_org_agenda_api",
        description = """
          Call a less-common allowlisted org-agenda-api endpoint. Prefer the
          dedicated tools for search, agenda, habits, capture, update, complete,
          and delete. Query and body are JSON objects.
        """.trimIndent(),
        properties = JSONObject()
          .put(
            "method",
            JSONObject()
              .put("type", "string")
              .put("enum", JSONArray(listOf("GET", "POST"))),
          )
          .put(
            "endpoint",
            JSONObject()
              .put("type", "string")
              .put("enum", JSONArray((getEndpoints + postEndpoints).sorted())),
          )
          .put("query", objectProperty("Optional query parameter names and values."))
          .put("body", objectProperty("Optional JSON request body.")),
        required = listOf("method", "endpoint"),
      ),
    )

  fun execute(
    name: String,
    arguments: JSONObject,
    credentials: WearCredentials,
  ): String {
    val result = when (name) {
      "search_todos" -> searchTodos(credentials, arguments)
      "get_agenda" -> getAgenda(credentials, arguments)
      "get_habits" -> getHabits(credentials, arguments)
      "capture_todo" -> captureTodo(credentials, arguments)
      "capture_category_todo" -> captureCategoryTodo(credentials, arguments)
      "update_todo" -> updateTodo(credentials, arguments)
      "complete_todo" -> completeTodo(credentials, arguments)
      "delete_todo" -> deleteTodo(credentials, arguments)
      "call_org_agenda_api" -> callGeneric(credentials, arguments)
      else -> errorResult("Unknown tool: $name")
    }
    return truncate(result)
  }

  private fun searchTodos(
    credentials: WearCredentials,
    arguments: JSONObject,
  ): String {
    val includeArchives = arguments.optBoolean("include_archives", false)
    val raw = apiRequest(
      credentials,
      "GET",
      "/get-all-todos",
      mapOf("include_archives" to includeArchives.toString()),
    )
    val payload = parseObject(raw) ?: return raw
    val todos = payload.optJSONArray("todos") ?: JSONArray()
    val query = arguments.optString("query").trim().lowercase()
    val state = arguments.optString("state").trim()
    val createdDate = arguments.optString("created_date").trim()
    val maxResults = arguments.optInt("max_results", 20).coerceIn(1, MAX_SEARCH_RESULTS)

    val matches = JSONArray()
    var totalMatches = 0
    var missingCreatedMetadata = 0
    for (index in 0 until todos.length()) {
      val todo = todos.optJSONObject(index) ?: continue
      if (query.isNotEmpty() && !todoSearchText(todo).contains(query)) continue
      if (state.isNotEmpty() && !todo.optString("todo").equals(state, ignoreCase = true)) continue

      if (createdDate.isNotEmpty()) {
        val created = createdValue(todo)
        if (created == null) {
          missingCreatedMetadata += 1
          continue
        }
        if (!created.contains(createdDate)) continue
      }

      totalMatches += 1
      if (matches.length() < maxResults) {
        matches.put(compactTodo(todo))
      }
    }

    return JSONObject()
      .put("status", "ok")
      .put("count", totalMatches)
      .put("returned", matches.length())
      .put("todos", matches)
      .put("missingCreatedMetadataCount", missingCreatedMetadata)
      .toString()
  }

  private fun getAgenda(
    credentials: WearCredentials,
    arguments: JSONObject,
  ): String {
    val query = mutableMapOf("span" to "day")
    putQueryIfPresent(arguments, query, "date")
    putQueryIfPresent(arguments, query, "include_overdue")
    putQueryIfPresent(arguments, query, "include_completed")
    return apiRequest(credentials, "GET", "/agenda", query)
  }

  private fun getHabits(
    credentials: WearCredentials,
    arguments: JSONObject,
  ): String {
    val query = mutableMapOf<String, String>()
    putQueryIfPresent(arguments, query, "preceding")
    putQueryIfPresent(arguments, query, "following")
    return apiRequest(credentials, "GET", "/all-habit-statuses", query)
  }

  private fun captureTodo(
    credentials: WearCredentials,
    arguments: JSONObject,
  ): String {
    val template = arguments.optString("template", "default")
    val values = arguments.optJSONObject("values")
      ?: return errorResult("capture_todo requires a values object")
    return apiRequest(
      credentials,
      "POST",
      "/capture",
      body = JSONObject().put("template", template).put("values", values),
    )
  }

  private fun captureCategoryTodo(
    credentials: WearCredentials,
    arguments: JSONObject,
  ): String {
    val type = arguments.optString("type")
    val category = arguments.optString("category")
    val title = arguments.optString("title")
    if (type.isBlank() || category.isBlank() || title.isBlank()) {
      return errorResult("capture_category_todo requires type, category, and title")
    }
    val body = JSONObject()
      .put("type", type)
      .put("category", category)
      .put("title", title)
    arguments.optJSONObject("values")?.let { values ->
      values.keys().forEach { key -> body.put(key, values.opt(key)) }
    }
    return apiRequest(credentials, "POST", "/category-capture", body = body)
  }

  private fun updateTodo(
    credentials: WearCredentials,
    arguments: JSONObject,
  ): String {
    val identifierError = validateIdentifier(arguments)
    if (identifierError != null) return errorResult(identifierError)
    val allowed = setOf(
      "id",
      "file",
      "pos",
      "title",
      "new_title",
      "state",
      "scheduled",
      "deadline",
      "priority",
      "body",
      "properties",
      "tags",
      "effort",
    )
    return apiRequest(credentials, "POST", "/update", body = copyKeys(arguments, allowed))
  }

  private fun completeTodo(
    credentials: WearCredentials,
    arguments: JSONObject,
  ): String {
    val identifierError = validateIdentifier(arguments)
    if (identifierError != null) return errorResult(identifierError)
    val body = copyKeys(
      arguments,
      setOf("id", "file", "pos", "title", "state", "override_date"),
    )
    if (!body.has("state")) body.put("state", "DONE")
    return apiRequest(credentials, "POST", "/complete", body = body)
  }

  private fun deleteTodo(
    credentials: WearCredentials,
    arguments: JSONObject,
  ): String {
    val identifierError = validateIdentifier(arguments)
    if (identifierError != null) return errorResult(identifierError)
    val body = copyKeys(arguments, setOf("id", "file", "pos", "title"))
      .put("include_children", true)
    return apiRequest(credentials, "POST", "/delete", body = body)
  }

  private fun callGeneric(
    credentials: WearCredentials,
    arguments: JSONObject,
  ): String {
    val method = arguments.optString("method").uppercase()
    val endpoint = arguments.optString("endpoint")
    val allowed = when (method) {
      "GET" -> endpoint in getEndpoints
      "POST" -> endpoint in postEndpoints
      else -> false
    }
    if (!allowed) {
      return errorResult("Endpoint $method $endpoint is not allowlisted")
    }

    val query = mutableMapOf<String, String>()
    arguments.optJSONObject("query")?.let { queryObject ->
      queryObject.keys().forEach { key ->
        val value = queryObject.opt(key)
        if (value != null && value != JSONObject.NULL) {
          query[key] = value.toString()
        }
      }
    }
    return apiRequest(
      credentials,
      method,
      endpoint,
      query,
      arguments.optJSONObject("body"),
    )
  }

  private fun apiRequest(
    credentials: WearCredentials,
    method: String,
    endpoint: String,
    query: Map<String, String> = emptyMap(),
    body: JSONObject? = null,
  ): String {
    val queryString = query.entries.joinToString("&") { (key, value) ->
      "${encode(key)}=${encode(value)}"
    }
    val urlString = credentials.apiUrl.trimEnd('/') + endpoint +
      if (queryString.isEmpty()) "" else "?$queryString"
    val connection = try {
      URL(urlString).openConnection() as HttpURLConnection
    } catch (_: Exception) {
      return errorResult("Invalid org-agenda-api URL")
    }

    return try {
      connection.requestMethod = method
      connection.connectTimeout = 10_000
      connection.readTimeout = 20_000
      connection.setRequestProperty("Accept", "application/json")
      connection.setRequestProperty("Authorization", credentials.authHeader())
      if (body != null) {
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { stream ->
          stream.write(body.toString().toByteArray(Charsets.UTF_8))
        }
      }

      val status = connection.responseCode
      val stream = if (status in 200..299) connection.inputStream else connection.errorStream
      val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
      if (status in 200..299) {
        response.ifBlank { JSONObject().put("status", "ok").toString() }
      } else {
        JSONObject()
          .put("status", "error")
          .put("httpStatus", status)
          .put("message", response.ifBlank { "org-agenda-api request failed" })
          .toString()
      }
    } catch (error: Exception) {
      errorResult("org-agenda-api network error: ${error.message ?: "unknown error"}")
    } finally {
      connection.disconnect()
    }
  }

  private fun validateIdentifier(arguments: JSONObject): String? {
    if (!arguments.optString("id").isNullOrBlank()) return null
    val hasFile = !arguments.optString("file").isNullOrBlank()
    val hasPos = arguments.has("pos") && !arguments.isNull("pos")
    return if (hasFile && hasPos) {
      null
    } else {
      "Identify the todo with id, or with both file and pos; use search_todos first"
    }
  }

  private fun compactTodo(todo: JSONObject): JSONObject = copyKeys(
    todo,
    setOf(
      "todo",
      "title",
      "tags",
      "scheduled",
      "deadline",
      "priority",
      "file",
      "pos",
      "id",
      "olpath",
      "category",
      "effectiveCategory",
      "properties",
      "isWindowHabit",
    ),
  )

  private fun todoSearchText(todo: JSONObject): String {
    val fields = listOf(
      todo.optString("title"),
      todo.optString("category"),
      todo.optString("effectiveCategory"),
      todo.optJSONArray("tags")?.toString().orEmpty(),
      todo.optJSONArray("olpath")?.toString().orEmpty(),
      todo.optJSONObject("properties")?.toString().orEmpty(),
    )
    return fields.joinToString("\n").lowercase()
  }

  private fun createdValue(todo: JSONObject): String? {
    val properties = todo.optJSONObject("properties") ?: return null
    val accepted = setOf("CREATED", "CREATED_AT", "DATE_CREATED", "ADDED")
    properties.keys().forEach { key ->
      if (key.uppercase() in accepted) {
        return properties.optString(key).takeIf { it.isNotBlank() }
      }
    }
    return null
  }

  private fun copyKeys(source: JSONObject, keys: Set<String>): JSONObject {
    val result = JSONObject()
    keys.forEach { key ->
      if (source.has(key)) result.put(key, source.opt(key))
    }
    return result
  }

  private fun putQueryIfPresent(
    source: JSONObject,
    destination: MutableMap<String, String>,
    key: String,
  ) {
    if (source.has(key) && !source.isNull(key)) {
      source.opt(key)?.toString()?.let { destination[key] = it }
    }
  }

  private fun functionTool(
    name: String,
    description: String,
    properties: JSONObject,
    required: List<String> = emptyList(),
  ): JSONObject = JSONObject()
    .put("type", "function")
    .put("name", name)
    .put("description", description)
    .put(
      "parameters",
      JSONObject()
        .put("type", "object")
        .put("properties", properties)
        .put("required", JSONArray(required))
        .put("additionalProperties", false),
    )
    // Several org-agenda-api payloads contain intentionally open objects
    // (capture values, properties, query params), so best-effort schemas are
    // more appropriate than strict Structured Outputs for this tool set.
    .put("strict", false)

  private fun todoIdentifierProperties(): JSONObject = JSONObject()
    .put("id", stringProperty("Org ID. Preferred when present."))
    .put("file", stringProperty("Org file path when no ID is present."))
    .put("pos", integerProperty("Character position in file when no ID is present."))
    .put("title", stringProperty("Current title, used only as a disambiguator."))

  private fun stringProperty(description: String): JSONObject =
    JSONObject().put("type", "string").put("description", description)

  private fun booleanProperty(description: String): JSONObject =
    JSONObject().put("type", "boolean").put("description", description)

  private fun integerProperty(description: String): JSONObject =
    JSONObject().put("type", "integer").put("description", description)

  private fun objectProperty(description: String): JSONObject =
    JSONObject()
      .put("type", "object")
      .put("description", description)
      .put("additionalProperties", true)

  private fun nullableObjectProperty(description: String): JSONObject =
    JSONObject()
      .put("type", JSONArray(listOf("object", "null")))
      .put("description", description)
      .put("additionalProperties", true)

  private fun nullableStringProperty(description: String): JSONObject =
    JSONObject()
      .put("type", JSONArray(listOf("string", "null")))
      .put("description", description)

  private fun nullableArrayProperty(description: String): JSONObject =
    JSONObject()
      .put("type", JSONArray(listOf("array", "null")))
      .put("items", JSONObject().put("type", "string"))
      .put("description", description)

  private fun parseObject(value: String): JSONObject? =
    try {
      JSONObject(value)
    } catch (_: Exception) {
      null
    }

  private fun errorResult(message: String): String =
    JSONObject().put("status", "error").put("message", message).toString()

  private fun truncate(value: String): String {
    if (value.length <= MAX_TOOL_OUTPUT_CHARS) return value
    return JSONObject()
      .put("status", "error")
      .put("message", "Tool result was too large; narrow the query")
      .put("truncatedPreview", value.take(MAX_TOOL_OUTPUT_CHARS))
      .toString()
  }

  private fun encode(value: String): String =
    URLEncoder.encode(value, Charsets.UTF_8.name())

  private fun WearCredentials.authHeader(): String {
    val token = "$username:$password"
    return "Basic " + Base64.encodeToString(token.toByteArray(), Base64.NO_WRAP)
  }
}
