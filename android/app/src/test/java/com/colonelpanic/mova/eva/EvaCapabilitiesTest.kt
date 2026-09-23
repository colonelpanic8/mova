package com.colonelpanic.mova.eva

import com.colonelpanic.mova.FakeOrgServer
import java.net.ServerSocket
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EvaCapabilitiesTest {

    private class MemoryStore : InvocationJournal.Store {
        var text: String? = null
        override fun read(): String? = text
        override fun write(text: String) {
            this.text = text
        }
    }

    private val server = FakeOrgServer().apply {
        on("/capture-templates", 200, """{"default":{"name":"Todo","prompts":[{"name":"Title","type":"string","required":true}]}}""")
        on("/capture", 200, """{"status":"created","template":"default"}""")
        on("/complete", 200, """{"status":"completed","title":"Taxes","newState":"DONE"}""")
        on("/update", 200, """{"status":"updated","title":"Taxes","file":"/org/gtd.org","pos":12}""")
        on("/delete", 200, """{"deleted":true,"title":"Taxes"}""")
    }
    private val store = MemoryStore()
    private var clock = 1_000_000L
    private var config = EvaCapabilities.Configuration(true, server.client(), "default")
    private var capabilities = newCapabilities()

    private fun newCapabilities() =
        EvaCapabilities({ config }, InvocationJournal(store, { 0L }), { clock })

    @After
    fun tearDown() = server.close()

    private fun revision(): String =
        JSONObject(capabilities.describe()).getJSONObject("descriptor").getString("descriptorRevision")

    private fun execute(
        capability: String,
        args: String,
        id: String = "eva-1",
        revision: String = revision(),
        uid: Int = 10_001,
    ): JSONObject = JSONObject(capabilities.execute(uid, id, revision, capability, args, clock + 20_000).envelope)

    private fun JSONObject.state(): String = getJSONObject("structuredContent").getString("state")

    @Test
    fun descriptorStaysWithinEvasFlatSchemaRules() {
        val reply = JSONObject(capabilities.describe())
        assertEquals("completed", reply.getString("status"))
        val descriptor = reply.getJSONObject("descriptor")
        assertTrue(descriptor.getString("descriptorRevision").matches(Regex("[A-Za-z0-9._:-]{1,128}")))
        val caps = descriptor.getJSONArray("capabilities")
        for (i in 0 until caps.length()) {
            val cap = caps.getJSONObject(i)
            val tool = cap.getJSONObject("tool")
            assertTrue(tool.getString("name").matches(Regex("[A-Za-z_][A-Za-z0-9_]{0,63}")))
            assertEquals(false, cap.getJSONObject("execution").getBoolean("requiresForeground"))
            val schema = tool.getJSONObject("inputSchema")
            assertEquals(false, schema.getBoolean("additionalProperties"))
            val props = schema.getJSONObject("properties")
            for (name in props.keys()) {
                val type = props.getJSONObject(name).getString("type")
                assertTrue("$name is $type", type in setOf("string", "integer", "boolean", "array", "object"))
                if (type == "object") assertFalse(props.getJSONObject(name).has("properties"))
            }
            val readOnly = tool.getJSONObject("annotations").getBoolean("readOnlyHint")
            assertEquals(cap.getString("effects") == "read", readOnly)
        }
    }

    @Test
    fun revisionFollowsTheSignedInAccount() {
        val before = revision()
        config = config.copy(client = com.colonelpanic.mova.MovaClient(server.url, "someone-else", "x"))
        assertNotEquals(before, revision())
        val reply = execute("complete_todo", """{"id":"abc"}""", revision = before)
        assertEquals("not_executed", reply.getString("status"))
        assertEquals("stale_descriptor", reply.getString("reasonCode"))
        assertEquals(0, server.count("/complete"))
    }

    @Test
    fun completedWriteCarriesStateAndReplaysWithoutResending() {
        val first = execute("complete_todo", """{"id":"abc"}""")
        assertEquals("completed", first.getString("status"))
        assertEquals("completed", first.state())
        assertEquals("eva-1", first.getJSONObject("structuredContent").getString("invocationId"))
        assertTrue(server.lastBody("/complete").getBoolean("strict"))

        capabilities = newCapabilities()
        val again = execute("complete_todo", """{"id":"abc"}""")
        assertEquals(first.toString(), again.toString())
        assertEquals(1, server.count("/complete"))
    }

    @Test
    fun reusedIdWithDifferentArgumentsIsRefused() {
        execute("complete_todo", """{"id":"abc"}""")
        val reply = execute("complete_todo", """{"id":"other"}""")
        assertEquals("not_executed", reply.getString("status"))
        assertEquals("invalid_arguments", reply.getString("reasonCode"))
        assertEquals("request_id_conflict", reply.state())
        assertEquals(1, server.count("/complete"))
    }

    @Test
    fun lostReplyIsUnknownAndNeverRepeated() {
        server.on("/complete", FakeOrgServer.Response(200, """{"status":"completed"}""", delayMillis = 4000))
        val reply = JSONObject(
            capabilities.execute(10_001, "eva-1", revision(), "complete_todo", """{"id":"abc"}""", clock + 2_500).envelope,
        )
        assertEquals("unknown", reply.getString("status"))
        assertEquals("uncertain", reply.state())
        val repeat = execute("complete_todo", """{"id":"abc"}""")
        assertEquals("unknown", repeat.getString("status"))
        assertEquals(1, server.count("/complete"))
    }

    @Test
    fun writeInterruptedByProcessDeathReportsUnknown() {
        val journal = InvocationJournal(store, { 0L })
        assertTrue(journal.begin(10_001, "eva-1", fingerprint("complete_todo", """{"id":"abc"}""")))
        capabilities = newCapabilities()

        val reply = execute("complete_todo", """{"id":"abc"}""")
        assertEquals("unknown", reply.getString("status"))
        assertEquals(0, server.count("/complete"))

        val status = execute("invocation_status", """{"invocationId":"eva-1"}""", id = "eva-2")
        assertEquals("interrupted", status.state())
    }

    @Test
    fun unreachableServerIsNotSentAndSafe() {
        val closedPort = ServerSocket(0).use { it.localPort }
        config = config.copy(client = com.colonelpanic.mova.MovaClient("http://127.0.0.1:$closedPort", "user", "secret"))
        val reply = execute("complete_todo", """{"id":"abc"}""")
        assertEquals("not_executed", reply.getString("status"))
        assertEquals("not_sent", reply.state())
    }

    @Test
    fun strictLookupConflictIsRejectedNotFailed() {
        server.on("/update", 409, """{"status":"error","code":"strict_lookup_conflict","message":"Expected todo title"}""")
        val reply = execute("update_todo", """{"file":"/org/gtd.org","pos":12,"title":"Taxes","scheduled":"2026-09-30"}""")
        assertEquals("not_executed", reply.getString("status"))
        assertEquals("rejected", reply.state())
        val sent = server.lastBody("/update")
        assertEquals("Taxes", sent.getString("title"))
        assertTrue(sent.getBoolean("strict"))
    }

    @Test
    fun serverErrorAfterSendIsUnknown() {
        server.on("/delete", 500, """{"status":"error","message":"save failed"}""")
        val reply = execute("delete_todo", """{"id":"abc"}""")
        assertEquals("unknown", reply.getString("status"))
        assertEquals("uncertain", reply.state())
    }

    @Test
    fun refsMustBeIdOrFilePosAndTitle() {
        for (args in listOf("""{"title":"Taxes"}""", """{"id":"a","file":"/f","pos":1,"title":"T"}""", """{"file":"/f","pos":1}""")) {
            val reply = execute("complete_todo", args, id = "eva-$args")
            assertEquals(args, "invalid_arguments", reply.getString("reasonCode"))
            assertEquals("invalid_request", reply.state())
        }
        assertEquals("invalid_arguments", execute("delete_todo", """{"file":"/f","pos":1}""").getString("reasonCode"))
        assertEquals(0, server.requests.count { it.method == "POST" })
    }

    @Test
    fun updateClearsWithEmptyValues() {
        val reply = execute("update_todo", """{"id":"abc","deadline":"","tags":[],"priority":"B"}""")
        assertEquals("completed", reply.getString("status"))
        val sent = server.lastBody("/update")
        assertTrue(sent.isNull("deadline"))
        assertTrue(sent.isNull("tags"))
        assertEquals("B", sent.getString("priority"))
    }

    @Test
    fun createFillsPromptsAndReportsTheMissingId() {
        server.on(
            "/capture-templates", 200,
            """{"meet":{"name":"Meeting","prompts":[{"name":"Title","type":"string","required":true},{"name":"Who","type":"string","required":true}]}}""",
        )
        val reply = execute("create_todo", """{"title":"Sync","template":"meet","prompts":{"Who":"Ana"},"tags":["work"]}""")
        assertEquals("completed", reply.getString("status"))
        val values = server.lastBody("/capture").getJSONObject("values")
        assertEquals("Sync", values.getString("Title"))
        assertEquals("Ana", values.getString("Who"))
        assertEquals(JSONArray(listOf("work")).toString(), values.getJSONArray("tags").toString())

        val missing = execute("create_todo", """{"title":"Sync","template":"meet"}""", id = "eva-2")
        assertEquals("invalid_arguments", missing.getString("reasonCode"))
        assertEquals(1, server.count("/capture"))
    }

    @Test
    fun successWithoutServerEvidenceIsUnknown() {
        server.on("/complete", 200, """{}""")
        val reply = execute("complete_todo", """{"id":"abc"}""")
        assertEquals("unknown", reply.getString("status"))
    }

    @Test
    fun lockedOrSignedOutRefusesWithoutSending() {
        config = EvaCapabilities.Configuration(false, null, "default")
        val locked = JSONObject(capabilities.execute(1, "eva-1", "x", "complete_todo", """{"id":"abc"}""", clock + 20_000).envelope)
        assertEquals("not_configured", locked.getString("reasonCode"))
        assertEquals("needs_unlock", locked.state())

        config = EvaCapabilities.Configuration(true, null, "default")
        val signedOut = execute("complete_todo", """{"id":"abc"}""")
        assertEquals("not_configured", signedOut.getString("reasonCode"))
        assertEquals("needs_configuration", signedOut.state())
        assertEquals(0, server.requests.size)
    }

    @Test
    fun readsReturnBoundedRows() {
        server.on(
            "/get-all-todos", 200,
            """{"todos":[{"id":"a","title":"Taxes","todo":"TODO","file":"/f","pos":1,"tags":["home"]},{"id":"b","title":"Bank","todo":"NEXT"}]}""",
        )
        val reply = execute("find_todos", """{"q":"tax"}""")
        assertEquals("completed", reply.getString("status"))
        val todos = reply.getJSONObject("structuredContent").getJSONArray("todos")
        assertEquals(1, todos.length())
        assertEquals("a", todos.getJSONObject(0).getString("id"))
        assertEquals("home", todos.getJSONObject(0).getString("tags"))
    }

    private fun fingerprint(capability: String, args: String) =
        EvaProtocol.sha256Hex(capability + "\n" + EvaProtocol.canonical(JSONObject(args)))
}
