package com.colonelpanic.mova.eva

import com.colonelpanic.mova.ApiResult
import com.colonelpanic.mova.Delivery
import com.colonelpanic.mova.MovaClient
import com.colonelpanic.mova.eva.EvaProtocol.Reply
import com.colonelpanic.mova.eva.EvaSchema.Bool
import com.colonelpanic.mova.eva.EvaSchema.Int64
import com.colonelpanic.mova.eva.EvaSchema.Str
import com.colonelpanic.mova.eva.EvaSchema.StrArray
import com.colonelpanic.mova.eva.EvaSchema.StrMap
import com.colonelpanic.mova.intents.IntentExecutor
import com.colonelpanic.mova.intents.IntentParseException
import com.colonelpanic.mova.intents.IntentParser
import com.colonelpanic.mova.intents.IntentRequest
import com.colonelpanic.mova.intents.ProviderRows
import com.colonelpanic.mova.intents.TodoRef
import org.json.JSONArray
import org.json.JSONObject

/**
 * Mova's catalog for EVA's installed-app protocol and its execution. Reads and
 * writes go straight to the server through [MovaClient]; nothing here needs an
 * activity, the React Native runtime, or an unlocked screen, only the
 * credential-encrypted storage that is available after the first unlock.
 */
class EvaCapabilities(
    private val configuration: () -> Configuration,
    private val journal: InvocationJournal,
    private val now: () -> Long,
) {
    /** A snapshot of the account an execution is pinned to. */
    data class Configuration(
        /** False before the first unlock after boot, when stored credentials are unreadable. */
        val userUnlocked: Boolean,
        val client: MovaClient?,
        val defaultTemplate: String,
    )

    /** The reply envelope plus whether server data may have changed. */
    data class Execution(val envelope: String, val dataChanged: Boolean = false)

    private class Call(val args: JSONObject, val client: MovaClient, val defaultTemplate: String, val callerUid: Int)

    private enum class Effects(val wire: String) { READ("read"), WRITE("write") }

    private class Capability(
        val name: String,
        val title: String,
        val description: String,
        val effects: Effects,
        val schema: EvaSchema,
        val destructive: Boolean = false,
        val run: (Call) -> Any,
    ) {
        val maxWaitMillis: Long get() = if (effects == Effects.WRITE) WRITE_WAIT_MILLIS else READ_WAIT_MILLIS

        fun toJson(): JSONObject {
            val annotations = JSONObject()
                .put("readOnlyHint", effects == Effects.READ)
                .put("openWorldHint", true)
            if (effects == Effects.WRITE) annotations.put("destructiveHint", destructive)
            return JSONObject()
                .put(
                    "tool",
                    JSONObject()
                        .put("name", name)
                        .put("title", title)
                        .put("description", description)
                        .put("inputSchema", schema.toJson())
                        .put("annotations", annotations),
                )
                .put("effects", effects.wire)
                .put(
                    "execution",
                    JSONObject().put("mode", "synchronous").put("requiresForeground", false)
                        .put("maxWaitMillis", maxWaitMillis),
                )
                .put("result", JSONObject().put("maxBytes", EvaProtocol.MAX_EXECUTE_BYTES))
        }
    }

    companion object {
        const val READ_WAIT_MILLIS = 10_000L
        const val WRITE_WAIT_MILLIS = 20_000L
        /** Kept back from the deadline so the reply still reaches EVA in time. */
        const val REPLY_MARGIN_MILLIS = 750L
        private const val MIN_WORK_MILLIS = 1_000L
        private const val STRUCTURED_BUDGET_BYTES = 12_000

        const val STATE_COMPLETED = "completed"
        const val STATE_UNCERTAIN = "uncertain"
        const val STATE_FAILED = "failed"
        const val STATE_NOT_SENT = "not_sent"
        const val STATE_REJECTED = "rejected"
        const val STATE_INVALID = "invalid_request"
        const val STATE_CONFLICT = "request_id_conflict"
        const val STATE_STALE = "stale_descriptor"
        const val STATE_BUSY = "busy"
        const val STATE_NEEDS_UNLOCK = "needs_unlock"
        const val STATE_NEEDS_CONFIGURATION = "needs_configuration"
        const val STATE_NEEDS_AUTHORIZATION = "needs_authorization"

        private const val NEEDS_UNLOCK_TEXT =
            "Mova cannot read its stored login until the phone has been unlocked once since it restarted. Nothing was sent."
        private const val UNREADABLE_TEXT =
            "Mova could not read its stored login right now. Unlock the phone or open Mova. Nothing was sent."
        private const val NOT_LOGGED_IN_TEXT = "Mova is not signed in to a server. Open Mova and log in. Nothing was sent."
        private const val UNCERTAIN_TEXT =
            "Mova sent the request but could not confirm whether the server applied it. Do not repeat it; " +
                "check the todo with a read first."

        private val DATE = Regex("""^\d{4}-\d{2}-\d{2}$""")
        private val REF_DESCRIPTION =
            "Identify the todo with id alone, or with file, pos and title together, exactly as returned by find_todos " +
                "or read_agenda. With file and pos the server refuses the change unless the heading there still has " +
                "this exact title."
        private val TIMESTAMP_DESCRIPTION =
            "YYYY-MM-DD or YYYY-MM-DDTHH:MM, optionally followed by a space and an org repeater such as +1w, ++1d or .+2m."
    }

    private val capabilities: List<Capability> = listOf(
        Capability(
            "list_templates", "List capture templates",
            "List the capture templates on Mova's active server. Pass a template's key as create_todo's template; " +
                "prompts lists each prompt's name, type (string, date, tags or body) and whether it is required. " +
                "Fill prompts other than the title and the universal fields through create_todo's prompts argument.",
            Effects.READ, EvaSchema.of(),
        ) { listTemplates(it.client, it.defaultTemplate) },
        Capability(
            "find_todos", "Find todos",
            "Search todos on Mova's active server by a case-insensitive substring of title, tags, state or category. " +
                "Returns at most limit rows plus the total match count. Absence from a capped result does not prove " +
                "no todo exists.",
            Effects.READ,
            EvaSchema.of(
                Str("q", "Search text. Omit to list todos.", minLength = 1),
                Int64("limit", "Maximum rows to return. Defaults to 25.", minimum = 1, maximum = 50),
            ),
        ) { findTodos(it.client, it.args) },
        Capability(
            "read_todo", "Read todo by id",
            "Read one todo by its org id from Mova's active server.",
            Effects.READ,
            EvaSchema.of(Str("id", "Org id returned by find_todos or read_agenda.", required = true, minLength = 1)),
        ) { readTodo(it.client, it.args.getString("id")) },
        Capability(
            "read_agenda", "Read agenda",
            "Read the agenda for a day or week from Mova's active server, including habit status.",
            Effects.READ,
            EvaSchema.of(
                Str("date", "YYYY-MM-DD. Defaults to today on the server.", minLength = 10, maxLength = 10),
                Str("span", "day or week. Defaults to day.", enum = listOf("day", "week")),
                Bool("include_overdue", "Include overdue items."),
                Bool("include_completed", "Include items completed on the date."),
            ),
        ) { readAgenda(it.client, it.args) },
        Capability(
            "create_todo", "Create todo",
            "Create a todo on Mova's active server through a capture template. The title fills the template's title " +
                "prompt. Completion means the server reported the entry created; it does not return the new entry's " +
                "id, so use find_todos to locate it.",
            Effects.WRITE,
            EvaSchema.of(
                Str("title", "Heading text.", required = true, minLength = 1, maxLength = 1000),
                Str("template", "Template key from list_templates. Defaults to Mova's default template.", minLength = 1),
                Str("scheduled", TIMESTAMP_DESCRIPTION, minLength = 10, maxLength = 40),
                Str("deadline", TIMESTAMP_DESCRIPTION, minLength = 10, maxLength = 40),
                Str("priority", "Single letter such as A.", minLength = 1, maxLength = 1),
                StrArray("tags", "Tags to set.", maxItems = 32, maxLength = 100),
                Str("state", "TODO keyword to start in, such as NEXT.", minLength = 1, maxLength = 40),
                Str("body", "Body text, applied only if the template declares a body prompt.", maxLength = 8000),
                StrMap("prompts", "Values for the template's other prompts, keyed by prompt name.", maxProperties = 16, maxLength = 1000),
            ),
        ) { createRequest(it.args) },
        Capability(
            "complete_todo", "Complete todo",
            "Set a todo's state, DONE by default, on Mova's active server. $REF_DESCRIPTION",
            Effects.WRITE,
            EvaSchema.of(
                *refProperties(),
                Str("state", "Target TODO keyword. Defaults to DONE.", minLength = 1, maxLength = 40),
                Str("date", "YYYY-MM-DD to backdate the completion.", minLength = 10, maxLength = 10),
            ),
        ) { completeRequest(it.args) },
        Capability(
            "update_todo", "Update or reschedule todo",
            "Change a todo's title, dates, priority, tags, state or body on Mova's active server. An empty string " +
                "clears scheduled, deadline, priority or body; an empty tags array removes all tags. $REF_DESCRIPTION",
            Effects.WRITE,
            EvaSchema.of(
                *refProperties(),
                Str("new_title", "Replacement heading text.", minLength = 1, maxLength = 1000),
                Str("scheduled", "$TIMESTAMP_DESCRIPTION Empty clears.", maxLength = 40),
                Str("deadline", "$TIMESTAMP_DESCRIPTION Empty clears.", maxLength = 40),
                Str("priority", "Single letter such as A. Empty clears.", maxLength = 1),
                StrArray("tags", "Replacement tags. Empty removes all tags.", maxItems = 32, maxLength = 100),
                Str("state", "TODO keyword.", minLength = 1, maxLength = 40),
                Str("body", "Replacement body. Empty clears.", maxLength = 8000),
            ),
        ) { updateRequest(it.args) },
        Capability(
            "delete_todo", "Delete todo",
            "Permanently delete a todo and its sub-headings from Mova's active server. Requires the todo's org id; " +
                "todos without one cannot be deleted here.",
            Effects.WRITE,
            EvaSchema.of(Str("id", "Org id returned by find_todos or read_agenda.", required = true, minLength = 1)),
            destructive = true,
        ) { IntentRequest.Delete(TodoRef(id = it.args.getString("id"))) },
        Capability(
            "invocation_status", "Check an earlier Mova change",
            "Report what Mova recorded for an earlier create, complete, update or delete by its invocation id, " +
                "including one whose reply never arrived. state is completed, uncertain, failed, rejected, not_sent, " +
                "in_progress, interrupted (Mova stopped mid-request; the outcome is unknown) or not_found. Mova keeps " +
                "records for 14 days.",
            Effects.READ,
            EvaSchema.of(Str("invocationId", "Invocation id of the earlier request.", required = true, minLength = 1, maxLength = 256)),
        ) { invocationStatus(it.callerUid, it.args.getString("invocationId")) },
    )

    private val byName = capabilities.associateBy { it.name }

    private val capabilitiesJson: JSONArray by lazy { JSONArray(capabilities.map { it.toJson() }) }

    /** Changes whenever the catalog content changes, so EVA re-approves new contracts. */
    private val catalogDigest: String by lazy { EvaProtocol.sha256Hex(EvaProtocol.canonical(capabilitiesJson)).take(16) }

    private fun authorizationScope(config: Configuration): String =
        config.client?.let { "account-" + EvaProtocol.sha256Hex(it.accountKey).take(16) } ?: "account-none"

    private fun descriptorRevision(config: Configuration): String =
        "mova-$catalogDigest.${authorizationScope(config)}"

    private fun readConfiguration(): Configuration? =
        try {
            configuration()
        } catch (e: Exception) {
            null
        }

    fun describe(): String {
        val config = readConfiguration()
            ?: return EvaProtocol.describeFailure(EvaProtocol.notExecuted(EvaProtocol.REASON_NOT_CONFIGURED, UNREADABLE_TEXT))
        if (!config.userUnlocked) {
            return EvaProtocol.describeFailure(EvaProtocol.notExecuted(EvaProtocol.REASON_NOT_CONFIGURED, NEEDS_UNLOCK_TEXT))
        }
        return EvaProtocol.describeEnvelope(
            JSONObject()
                .put("protocolVersion", EvaProtocol.PROTOCOL_VERSION)
                .put("descriptorRevision", descriptorRevision(config))
                .put("authorizationScopeRevision", authorizationScope(config))
                .put("title", "Mova")
                .put("capabilities", capabilitiesJson),
        )
    }

    fun maxWaitMillis(capability: String): Long = byName[capability]?.maxWaitMillis ?: READ_WAIT_MILLIS

    fun isWrite(capability: String): Boolean = byName[capability]?.effects == Effects.WRITE

    fun has(capability: String): Boolean = capability in byName

    fun schema(capability: String): EvaSchema? = byName[capability]?.schema

    /** The capability list alone, for callers that discover it without the AIDL envelope. */
    fun catalog(): JSONArray = capabilitiesJson

    /** A reply for a request refused before it reached [execute], shaped for the capability's effects. */
    fun rejection(capability: String, invocationId: String, reasonCode: String, text: String, state: String): String {
        val structured = if (isWrite(capability)) writeState(state, invocationId, capability) else null
        return EvaProtocol.executeEnvelope(EvaProtocol.notExecuted(reasonCode, text, structured))
    }

    /** A null [expectedRevision] skips the descriptor check, for callers without a describe step. */
    fun execute(
        callerUid: Int,
        invocationId: String,
        expectedRevision: String?,
        capabilityName: String,
        argumentsJson: String,
        deadline: Long,
    ): Execution {
        val capability = byName[capabilityName]
            ?: return Execution(
                EvaProtocol.executeEnvelope(
                    EvaProtocol.notExecuted(EvaProtocol.REASON_INVALID_ARGUMENTS, "Mova has no capability '$capabilityName'."),
                ),
            )
        val write = capability.effects == Effects.WRITE
        fun state(state: String) = if (write) writeState(state, invocationId, capability.name) else null
        fun reply(reply: Reply) = Execution(EvaProtocol.executeEnvelope(reply))

        val args = parseArguments(argumentsJson)
            ?.takeIf { capability.schema.check(it) == null }
            ?: return reply(
                EvaProtocol.notExecuted(
                    EvaProtocol.REASON_INVALID_ARGUMENTS,
                    parseArguments(argumentsJson)?.let { capability.schema.check(it) } ?: "Arguments are not a JSON object.",
                    state(STATE_INVALID),
                ),
            )

        val config = readConfiguration()
            ?: return reply(EvaProtocol.notExecuted(EvaProtocol.REASON_NOT_CONFIGURED, UNREADABLE_TEXT, state(STATE_NEEDS_CONFIGURATION)))
        if (!config.userUnlocked) {
            return reply(EvaProtocol.notExecuted(EvaProtocol.REASON_NOT_CONFIGURED, NEEDS_UNLOCK_TEXT, state(STATE_NEEDS_UNLOCK)))
        }

        val fingerprint = EvaProtocol.sha256Hex(capability.name + "\n" + EvaProtocol.canonical(args))
        if (write) {
            when (val prior = journal.lookup(callerUid, invocationId, fingerprint)) {
                is InvocationJournal.Prior.Replay -> return Execution(prior.response)
                InvocationJournal.Prior.Conflict -> return reply(
                    EvaProtocol.notExecuted(
                        EvaProtocol.REASON_INVALID_ARGUMENTS,
                        "This invocation ID was already used for a different request. Nothing was sent.",
                        state(STATE_CONFLICT),
                    ),
                )
                InvocationJournal.Prior.InFlight, InvocationJournal.Prior.Interrupted ->
                    return reply(EvaProtocol.unknown(UNCERTAIN_TEXT, structured = state(STATE_UNCERTAIN)))
                InvocationJournal.Prior.None -> Unit
            }
        }

        if (expectedRevision != null && expectedRevision != descriptorRevision(config)) {
            return reply(
                EvaProtocol.notExecuted(
                    EvaProtocol.REASON_STALE_DESCRIPTOR,
                    "Mova's capabilities or signed-in account changed since EVA approved them. Nothing was sent.",
                    state(STATE_STALE),
                ),
            )
        }
        val baseClient = config.client
            ?: return reply(EvaProtocol.notExecuted(EvaProtocol.REASON_NOT_CONFIGURED, NOT_LOGGED_IN_TEXT, state(STATE_NEEDS_CONFIGURATION)))
        val effectiveDeadline = minOf(deadline, now() + capability.maxWaitMillis) - REPLY_MARGIN_MILLIS
        if (effectiveDeadline - now() < MIN_WORK_MILLIS) {
            return reply(
                EvaProtocol.notExecuted(EvaProtocol.REASON_DEADLINE_EXCEEDED, "Too little time was left to start. Nothing was sent.", state(STATE_NOT_SENT)),
            )
        }
        val client = baseClient.withDeadline { effectiveDeadline - now() }

        val prepared = try {
            capability.run(Call(args, client, config.defaultTemplate, callerUid))
        } catch (e: IntentParseException) {
            return reply(EvaProtocol.notExecuted(EvaProtocol.REASON_INVALID_ARGUMENTS, e.message ?: "Invalid arguments.", state(STATE_INVALID)))
        } catch (e: Exception) {
            // Writes only build a request here; reads have no side effects.
            return reply(
                if (write) {
                    EvaProtocol.notExecuted(null, "Mova could not prepare the request. Nothing was sent.", state(STATE_NOT_SENT))
                } else {
                    EvaProtocol.failed("Mova could not read the server's answer.")
                },
            )
        }
        if (prepared is Reply) return reply(prepared)
        val request = prepared as IntentRequest

        val started = try {
            journal.begin(callerUid, invocationId, fingerprint)
        } catch (e: Exception) {
            return reply(EvaProtocol.notExecuted(null, "Mova could not record the request, so it did not send it.", state(STATE_NOT_SENT)))
        }
        if (!started) return reply(EvaProtocol.unknown(UNCERTAIN_TEXT, structured = state(STATE_UNCERTAIN)))

        val outcome = try {
            writeReply(capability.name, invocationId, request, IntentExecutor(client) { config.defaultTemplate }.run(request))
        } catch (e: Exception) {
            EvaProtocol.unknown(UNCERTAIN_TEXT, structured = state(STATE_UNCERTAIN))
        }
        val envelope = EvaProtocol.executeEnvelope(outcome)
        try {
            journal.finish(callerUid, invocationId, envelope)
        } catch (e: Exception) {
            // The started record stays, so a repeat reports unknown rather than re-executing.
        }
        return Execution(envelope, dataChanged = outcome.status != EvaProtocol.STATUS_NOT_EXECUTED)
    }

    private fun parseArguments(json: String): JSONObject? {
        if (EvaProtocol.utf8Length(json) > EvaProtocol.MAX_ARGUMENTS_BYTES) return null
        return try {
            JSONObject(json)
        } catch (e: Exception) {
            null
        }
    }

    private fun writeState(state: String, invocationId: String, operation: String): JSONObject =
        JSONObject().put("state", state).put("invocationId", invocationId).put("operation", operation)

    private fun writeReply(
        operation: String,
        invocationId: String,
        request: IntentRequest,
        result: ApiResult<IntentExecutor.Outcome>,
    ): Reply {
        fun state(state: String) = writeState(state, invocationId, operation)
        return when (result) {
            is ApiResult.Ok -> {
                val outcome = result.value
                if (!IntentExecutor.confirmsApplied(request, outcome.response)) {
                    EvaProtocol.unknown(
                        "The server answered without confirming the change. Do not repeat it; check the todo with a read first.",
                        structured = state(STATE_UNCERTAIN).put("serverStatus", outcome.response.optString("status")),
                    )
                } else {
                    val structured = state(STATE_COMPLETED)
                    outcome.extras.forEach { (key, value) ->
                        when (key) {
                            IntentExecutor.EXTRA_STATUS -> structured.put("serverStatus", value)
                            else -> value?.let { structured.put(key, it) }
                        }
                    }
                    outcome.response.optString("newState").takeIf { it.isNotEmpty() }?.let { structured.put("newState", it) }
                    val note = if (request is IntentRequest.Create) " The server does not return the new entry's id." else ""
                    EvaProtocol.completed(outcome.message + "." + note, structured)
                }
            }
            is ApiResult.Err -> when {
                result.invalid ->
                    EvaProtocol.notExecuted(EvaProtocol.REASON_INVALID_ARGUMENTS, "${result.message}. Nothing was sent.", state(STATE_INVALID))
                result.httpStatus == 401 ->
                    EvaProtocol.notExecuted(
                        EvaProtocol.REASON_NOT_CONFIGURED,
                        "The server rejected Mova's stored login. Open Mova and log in again. Nothing was changed.",
                        state(STATE_NEEDS_CONFIGURATION),
                    )
                result.delivery == Delivery.NOT_SENT ->
                    EvaProtocol.notExecuted(
                        if (result.deadlineExceeded) EvaProtocol.REASON_DEADLINE_EXCEEDED else null,
                        "${result.message}. Nothing was sent; it is safe to try again.",
                        state(STATE_NOT_SENT),
                    )
                result.delivery == Delivery.REJECTED && result.httpStatus in 400..499 ->
                    EvaProtocol.notExecuted(null, "The server refused the request: ${result.message}", state(STATE_REJECTED))
                result.delivery == Delivery.REJECTED ->
                    EvaProtocol.failed("The server reported an error: ${result.message}", state(STATE_FAILED))
                else -> EvaProtocol.unknown(
                    "$UNCERTAIN_TEXT (${result.message})",
                    if (result.deadlineExceeded) EvaProtocol.REASON_DEADLINE_EXCEEDED else null,
                    state(STATE_UNCERTAIN),
                )
            }
        }
    }

    private fun readFailure(err: ApiResult.Err): Reply = when {
        err.httpStatus == 401 -> EvaProtocol.notExecuted(
            EvaProtocol.REASON_NOT_CONFIGURED,
            "The server rejected Mova's stored login. Open Mova and log in again.",
        )
        err.delivery == Delivery.NOT_SENT && err.deadlineExceeded ->
            EvaProtocol.notExecuted(EvaProtocol.REASON_DEADLINE_EXCEEDED, err.message)
        err.delivery == Delivery.NOT_SENT -> EvaProtocol.notExecuted(null, "Could not reach Mova's server: ${err.message}")
        else -> EvaProtocol.failed("Mova's server read failed: ${err.message}")
    }

    // Requests. Refs are id alone or file+pos+title; title-only lookups are
    // never used for writes, and strict stops the server from falling back.

    private fun refProperties(): Array<EvaSchema.Property> = arrayOf(
        Str("id", "Org id.", minLength = 1),
        Str("file", "Absolute org file path; requires pos and title.", minLength = 1, maxLength = 4096),
        Int64("pos", "Buffer position; requires file and title.", minimum = 1, maximum = Int.MAX_VALUE.toLong()),
        Str("title", "Exact current heading title; required with file and pos.", minLength = 1, maxLength = 1000),
    )

    private fun refParams(args: JSONObject): List<Pair<String, String>> {
        val id = args.optString("id").takeIf { args.has("id") }
        val hasPosition = args.has("file") || args.has("pos")
        if (id != null) {
            if (hasPosition || args.has("title")) {
                throw IntentParseException("Pass id alone, or file, pos and title together, not both")
            }
            return listOf("id" to id, "strict" to "true")
        }
        if (!(args.has("file") && args.has("pos") && args.has("title"))) {
            throw IntentParseException("Pass id, or file, pos and title together")
        }
        return listOf(
            "file" to args.getString("file"),
            "pos" to args.get("pos").toString(),
            "title" to args.getString("title"),
            "strict" to "true",
        )
    }

    private fun parse(host: String, params: List<Pair<String, String>>): IntentRequest =
        IntentParser.parse(host, params.groupBy({ it.first }, { it.second }))

    private fun stringParams(args: JSONObject, vararg names: String): List<Pair<String, String>> =
        names.filter { args.has(it) }.map { it to args.getString(it) }

    private fun tagParams(args: JSONObject): List<Pair<String, String>> {
        val tags = args.optJSONArray("tags") ?: return emptyList()
        if (tags.length() == 0) return listOf("tags" to "")
        return (0 until tags.length()).map { "tags" to tags.getString(it) }
    }

    private fun createRequest(args: JSONObject): IntentRequest {
        val params = stringParams(args, "title", "template", "scheduled", "deadline", "priority", "state", "body") +
            tagParams(args)
        val reserved = setOf("id", "file", "pos", "title", "template", "scheduled", "deadline", "priority", "tags",
            "state", "body", "confirm", "strict", "new_title", "date", "git")
        val prompts = args.optJSONObject("prompts")
        val promptParams = prompts?.keys()?.asSequence()?.map { key ->
            if (key.lowercase() in reserved) {
                throw IntentParseException("Prompt '$key' collides with a named argument; pass it through that argument")
            }
            key to prompts.getString(key)
        }?.toList().orEmpty()
        return parse(IntentParser.HOST_CREATE, params + promptParams)
    }

    private fun completeRequest(args: JSONObject): IntentRequest {
        args.optString("date").takeIf { args.has("date") }?.let {
            if (!DATE.matches(it)) throw IntentParseException("Invalid date '$it' (expected YYYY-MM-DD)")
        }
        return parse(IntentParser.HOST_COMPLETE, refParams(args) + stringParams(args, "state", "date"))
    }

    private fun updateRequest(args: JSONObject): IntentRequest =
        parse(
            IntentParser.HOST_UPDATE,
            refParams(args) +
                stringParams(args, "new_title", "scheduled", "deadline", "priority", "state", "body") +
                tagParams(args),
        )

    // Reads

    private fun invocationStatus(callerUid: Int, invocationId: String): Reply {
        val recorded = journal.recorded(callerUid, invocationId)
        val structured = JSONObject().put("invocationId", invocationId)
        return when (recorded) {
            null -> EvaProtocol.completed("Mova has no record of $invocationId.", structured.put("state", "not_found"))
            is InvocationJournal.Recorded.Started -> {
                val state = if (recorded.running) "in_progress" else "interrupted"
                val text = if (recorded.running) {
                    "Mova is still waiting on the server for $invocationId."
                } else {
                    "Mova stopped while $invocationId was in flight; whether the server applied it is unknown."
                }
                EvaProtocol.completed(text, structured.put("state", state))
            }
            is InvocationJournal.Recorded.Finished -> {
                val reply = JSONObject(recorded.response)
                val prior = reply.optJSONObject("structuredContent") ?: JSONObject()
                val text = reply.optJSONArray("content")?.optJSONObject(0)?.optString("text").orEmpty()
                prior.keys().forEach { key -> if (!structured.has(key)) structured.put(key, prior.get(key)) }
                structured.put("status", reply.optString("status"))
                EvaProtocol.completed("Recorded outcome of $invocationId: $text", structured)
            }
        }
    }

    private fun listTemplates(client: MovaClient, defaultTemplate: String): Reply =
        when (val result = client.getTemplates()) {
            is ApiResult.Err -> readFailure(result)
            is ApiResult.Ok -> {
                val items = result.value.values.map { template ->
                    JSONObject()
                        .put("key", template.key)
                        .put("name", template.name)
                        .put("is_default", template.key == defaultTemplate)
                        .put("title_prompt", template.titlePrompt)
                        .put(
                            "prompts",
                            JSONArray(
                                template.prompts.map {
                                    JSONObject().put("name", it.name).put("type", it.type).put("required", it.required)
                                },
                            ),
                        )
                }
                bounded("templates", items, items.size) { t ->
                    "- ${t.getString("key")}: ${t.getString("name")}" + if (t.getBoolean("is_default")) " (default)" else ""
                }
            }
        }

    private fun findTodos(client: MovaClient, args: JSONObject): Reply {
        val limit = if (args.has("limit")) args.getInt("limit") else 25
        return when (val result = client.getAllTodos(query = args.optString("q").takeIf { args.has("q") }, limit = limit)) {
            is ApiResult.Err -> readFailure(result)
            is ApiResult.Ok -> bounded("todos", result.value.todos.take(limit).map(::todoJson), result.value.total, ::todoLine)
        }
    }

    private fun readTodo(client: MovaClient, id: String): Reply =
        when (val result = client.findTodo(TodoRef(id = id))) {
            is ApiResult.Err -> readFailure(result)
            is ApiResult.Ok -> {
                val todo = result.value
                if (todo == null) {
                    EvaProtocol.completed("No todo with id $id.", JSONObject().put("found", false))
                } else {
                    val json = todoJson(todo)
                    EvaProtocol.completed(todoLine(json), JSONObject().put("found", true).put("todo", json))
                }
            }
        }

    private fun readAgenda(client: MovaClient, args: JSONObject): Reply {
        val date = args.optString("date").takeIf { args.has("date") }
        if (date != null && !DATE.matches(date)) {
            return EvaProtocol.notExecuted(EvaProtocol.REASON_INVALID_ARGUMENTS, "Invalid date '$date' (expected YYYY-MM-DD)")
        }
        val result = client.getAgenda(
            date = date,
            span = args.optString("span").takeIf { args.has("span") } ?: "day",
            includeOverdue = if (args.has("include_overdue")) args.getBoolean("include_overdue") else null,
            includeCompleted = if (args.has("include_completed")) args.getBoolean("include_completed") else null,
        )
        return when (result) {
            is ApiResult.Err -> readFailure(result)
            is ApiResult.Ok -> {
                val entries = result.value.optJSONArray("entries") ?: JSONArray()
                val items = (0 until entries.length()).mapNotNull { entries.optJSONObject(it) }.map(::todoJson)
                bounded("entries", items, items.size, ::todoLine)
            }
        }
    }

    private val todoColumns = arrayOf(
        ProviderRows.COL_ID, ProviderRows.COL_FILE, ProviderRows.COL_POS, ProviderRows.COL_TITLE,
        ProviderRows.COL_STATE, ProviderRows.COL_PRIORITY, ProviderRows.COL_SCHEDULED, ProviderRows.COL_DEADLINE,
        ProviderRows.COL_TAGS, ProviderRows.COL_CATEGORY, ProviderRows.COL_DATE_RELEVANCE,
        ProviderRows.COL_COMPLETED_AT, ProviderRows.COL_IS_WINDOW_HABIT,
        ProviderRows.COL_HABIT_COMPLETED_ON_QUERY_DATE, ProviderRows.COL_HABIT_COMPLETION_NEEDED_TODAY,
    )

    private val booleanColumns = setOf(
        ProviderRows.COL_IS_WINDOW_HABIT,
        ProviderRows.COL_HABIT_COMPLETED_ON_QUERY_DATE,
        ProviderRows.COL_HABIT_COMPLETION_NEEDED_TODAY,
    )

    private fun todoJson(todo: JSONObject): JSONObject {
        val json = JSONObject()
        ProviderRows.row(todo, todoColumns).forEachIndexed { i, value ->
            val column = todoColumns[i]
            when {
                value == null -> Unit
                column in booleanColumns -> json.put(column, value == 1)
                else -> json.put(column, value)
            }
        }
        return json
    }

    private fun todoLine(todo: JSONObject): String = buildString {
        append("- ")
        todo.optString(ProviderRows.COL_STATE).takeIf { it.isNotEmpty() }?.let { append(it).append(' ') }
        append(todo.optString(ProviderRows.COL_TITLE))
        todo.optString(ProviderRows.COL_ID).takeIf { it.isNotEmpty() }?.let { append(" (id ").append(it).append(')') }
        todo.optString(ProviderRows.COL_SCHEDULED).takeIf { it.isNotEmpty() }?.let { append(" scheduled ").append(it) }
        todo.optString(ProviderRows.COL_DEADLINE).takeIf { it.isNotEmpty() }?.let { append(" deadline ").append(it) }
    }

    /** Keeps whole items while they fit the reply budget and says when some were left out. */
    private fun bounded(key: String, items: List<JSONObject>, total: Int, line: (JSONObject) -> String): Reply {
        val kept = JSONArray()
        val lines = StringBuilder()
        var used = 0
        for (item in items) {
            val text = line(item)
            val size = EvaProtocol.utf8Length(item.toString()) + EvaProtocol.utf8Length(text) + 2
            if (used + size > STRUCTURED_BUDGET_BYTES) break
            kept.put(item)
            lines.append('\n').append(text)
            used += size
        }
        val truncated = kept.length() < total
        val header = if (truncated) "${kept.length()} of $total $key; more exist." else "${kept.length()} $key."
        return EvaProtocol.completed(
            header + lines,
            JSONObject().put(key, kept).put("total", total).put("truncated", truncated),
            truncated,
        )
    }
}
