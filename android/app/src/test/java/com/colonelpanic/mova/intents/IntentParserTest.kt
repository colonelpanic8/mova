package com.colonelpanic.mova.intents

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class IntentParserTest {

    private fun params(vararg pairs: Pair<String, String>): Map<String, List<String>> =
        pairs.groupBy({ it.first }, { it.second })

    private fun parseError(host: String, vararg pairs: Pair<String, String>): String {
        try {
            IntentParser.parse(host, params(*pairs))
        } catch (e: IntentParseException) {
            return e.message ?: ""
        }
        fail("expected IntentParseException")
        return ""
    }

    @Test
    fun createParsesAllFieldsAndKeepsUnknownParamsAsExtras() {
        val request = IntentParser.parse(
            "create",
            params(
                "title" to " Buy milk ",
                "template" to "capture-g",
                "scheduled" to "2026-09-20T9:30 +1w",
                "deadline" to "2026-09-25",
                "priority" to "b",
                "tags" to "home, errands",
                "tags" to "urgent",
                "state" to "NEXT",
                "body" to "Whole milk",
                "Project" to "groceries",
                "confirm" to "1",
            ),
        ) as IntentRequest.Create

        assertEquals("Buy milk", request.title)
        assertEquals("capture-g", request.template)
        assertEquals(
            OrgTimestamp("2026-09-20", "09:30", Repeater("+", 1, "w")),
            (request.fields.scheduled as Patch.Set).value,
        )
        assertEquals(OrgTimestamp("2026-09-25"), (request.fields.deadline as Patch.Set).value)
        assertEquals("B", (request.fields.priority as Patch.Set).value)
        assertEquals(listOf("home", "errands", "urgent"), (request.fields.tags as Patch.Set).value)
        assertEquals("NEXT", (request.fields.state as Patch.Set).value)
        assertEquals("Whole milk", (request.fields.body as Patch.Set).value)
        assertEquals(mapOf("Project" to "groceries"), request.extras)
    }

    @Test
    fun createIgnoresBlankOptionalFieldsInsteadOfClearing() {
        val request = IntentParser.parse(
            "create",
            params("title" to "x", "scheduled" to "", "tags" to " , "),
        ) as IntentRequest.Create
        assertNull(request.fields.scheduled)
        assertNull(request.fields.tags)
        assertNull(request.template)
    }

    @Test
    fun createRequiresTitle() {
        assertTrue(parseError("create", "template" to "default").contains("title"))
    }

    @Test
    fun completeDefaultsToDoneAndAcceptsTitleOnlyReference() {
        val request = IntentParser.parse(
            "complete",
            params("title" to "Buy milk", "confirm" to "true"),
        ) as IntentRequest.Complete
        assertEquals("DONE", request.state)
        assertEquals(TodoRef(title = "Buy milk"), request.ref)
        assertFalse(request.strict)
        assertNull(request.overrideDate)
    }

    @Test
    fun completeParsesStateDateAndStrict() {
        val request = IntentParser.parse(
            "complete",
            params("id" to "abc", "state" to "CANCELLED", "date" to "2026-09-13", "strict" to "true"),
        ) as IntentRequest.Complete
        assertEquals("CANCELLED", request.state)
        assertEquals("2026-09-13", request.overrideDate)
        assertTrue(request.strict)
        assertEquals("Mark \"abc\" as CANCELLED\nCompletion date: 2026-09-13", request.describe())
    }

    @Test
    fun completeRejectsBadDateAndPos() {
        assertTrue(parseError("complete", "id" to "x", "date" to "tomorrow").contains("YYYY-MM-DD"))
        assertTrue(parseError("complete", "file" to "/a.org", "pos" to "12x").contains("pos"))
    }

    @Test
    fun updateBuildsServerPayloadWithClears() {
        val request = IntentParser.parse(
            "reschedule",
            params(
                "file" to "/data/org/gtd.org",
                "pos" to "120",
                "title" to "Old",
                "new_title" to "New",
                "scheduled" to "2026-10-01 14:00",
                "deadline" to "",
                "priority" to "",
                "tags" to "a,b",
                "state" to "TODO",
            ),
        ) as IntentRequest.Update

        assertEquals(TodoRef(file = "/data/org/gtd.org", pos = 120, title = "Old"), request.ref)
        val json = request.updatesJson()
        assertEquals("New", json.getString("new_title"))
        assertEquals("2026-10-01", json.getJSONObject("scheduled").getString("date"))
        assertEquals("14:00", json.getJSONObject("scheduled").getString("time"))
        assertTrue(json.isNull("deadline"))
        assertTrue(json.has("deadline"))
        assertTrue(json.isNull("priority"))
        assertEquals(listOf("a", "b"), (0 until 2).map { json.getJSONArray("tags").getString(it) })
        assertEquals("TODO", json.getString("state"))
        assertFalse(json.has("body"))
        assertEquals(
            listOf("Update \"Old\"", "Title: New", "Scheduled: 2026-10-01 14:00", "Deadline: cleared",
                "Priority: cleared", "Tags: a, b", "State: TODO"),
            request.describe().split("\n"),
        )
    }

    @Test
    fun updateWithoutChangesIsRejected() {
        assertTrue(parseError("update", "id" to "abc").contains("Nothing to update"))
    }

    @Test
    fun deleteNeedsPreciseReference() {
        assertTrue(parseError("delete", "title" to "Buy milk").contains("id, or file and pos"))
        val request = IntentParser.parse("delete", params("id" to "abc")) as IntentRequest.Delete
        assertEquals(TodoRef(id = "abc"), request.ref)
    }

    @Test
    fun refreshParsesGitFlag() {
        assertFalse((IntentParser.parse("refresh", emptyMap()) as IntentRequest.Refresh).git)
        assertTrue((IntentParser.parse("refresh", params("git" to "true")) as IntentRequest.Refresh).git)
    }

    @Test
    fun unknownHostIsRejected() {
        assertTrue(parseError("explode", "id" to "x").contains("Unknown action"))
    }

    @Test
    fun timestampFormats() {
        assertEquals(OrgTimestamp("2026-01-05"), OrgTimestamp.parse("2026-01-05"))
        assertEquals(OrgTimestamp("2026-01-05", "08:00"), OrgTimestamp.parse("2026-01-05T08:00:00"))
        assertEquals(
            OrgTimestamp("2026-01-05", null, Repeater(".+", 2, "m")),
            OrgTimestamp.parse("2026-01-05 .+2m"),
        )
        assertEquals(
            OrgTimestamp("2026-01-05", "10:00", Repeater("++", 1, "d")),
            OrgTimestamp.parse("2026-01-05T10:00 ++1d"),
        )
        val json: JSONObject = OrgTimestamp.parse("2026-01-05T10:00 ++1d").toJson()
        assertEquals("++", json.getJSONObject("repeater").getString("type"))
        assertEquals(1, json.getJSONObject("repeater").getInt("value"))
        assertEquals("d", json.getJSONObject("repeater").getString("unit"))
        for (bad in listOf("2026-1-5", "next week", "2026-01-05 +1x", "2026-01-05T25")) {
            try {
                OrgTimestamp.parse(bad)
                fail("expected failure for $bad")
            } catch (e: IntentParseException) {
                assertTrue(e.message!!.contains(bad))
            }
        }
    }
}
