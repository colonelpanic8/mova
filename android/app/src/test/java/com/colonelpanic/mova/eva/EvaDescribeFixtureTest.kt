package com.colonelpanic.mova.eva

import com.colonelpanic.mova.MovaClient
import java.io.File
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Keeps docs/eva-extension-describe.json equal to the live describe reply, so
 * EVA can decode the exact catalog Mova ships. Regenerate with
 * `UPDATE_EVA_FIXTURE=1` (then prettier) after an intentional catalog change.
 */
class EvaDescribeFixtureTest {

    @Test
    fun fixtureMatchesDescribeReply() {
        val capabilities = EvaCapabilities(
            { EvaCapabilities.Configuration(true, MovaClient("https://org.example.com", "user", "secret"), "default") },
            InvocationJournal(
                object : InvocationJournal.Store {
                    override fun read(): String? = null
                    override fun write(text: String) = Unit
                },
                { 0L },
            ),
            { 0L },
        )
        val live = JSONObject(capabilities.describe())
        val fixture = File("../../docs/eva-extension-describe.json")
        if (System.getenv("UPDATE_EVA_FIXTURE") == "1") fixture.writeText(live.toString(2) + "\n")
        assertEquals(EvaProtocol.canonical(live), EvaProtocol.canonical(JSONObject(fixture.readText())))
    }
}
