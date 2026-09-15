package com.colonelpanic.mova.intents

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class CaptureMapperTest {

    private val calendar = TemplateInfo.fromJson(
        "capture-c",
        JSONObject(
            """{"name":"Calendar entry","prompts":[
                 {"name":"Title","type":"string","required":true},
                 {"name":"When","type":"date","required":true},
                 {"name":"Tags","type":"tags","required":false}]}""",
        ),
    )

    private fun create(
        title: String,
        fields: TodoFields = TodoFields(),
        extras: Map<String, String> = emptyMap(),
    ) = IntentRequest.Create(title, "capture-c", fields, extras)

    @Test
    fun titleGoesToFirstRequiredStringPrompt() {
        val vocab = TemplateInfo.fromJson(
            "capture-v",
            JSONObject("""{"name":"Vocabulary","prompts":[{"name":"Word","type":"string","required":true}]}"""),
        )
        val values = CaptureMapper.buildValues(vocab, create("serendipity"))
        assertEquals("serendipity", values.getString("Word"))
        assertEquals(1, values.length())
    }

    @Test
    fun universalFieldsUseServerNamesAndFormats() {
        val fields = TodoFields(
            scheduled = Patch.Set(OrgTimestamp("2026-09-20", "10:00", Repeater("+", 1, "w"))),
            priority = Patch.Set("A"),
            tags = Patch.Set(listOf("x", "y")),
            state = Patch.Set("NEXT"),
        )
        val values = CaptureMapper.buildValues(calendar, create("Dentist", fields))
        assertEquals("Dentist", values.getString("Title"))
        assertEquals("2026-09-20", values.getJSONObject("scheduled").getString("date"))
        assertEquals("10:00", values.getJSONObject("scheduled").getString("time"))
        assertEquals("w", values.getJSONObject("scheduled").getJSONObject("repeater").getString("unit"))
        assertEquals("A", values.getString("priority"))
        assertEquals("y", values.getJSONArray("tags").getString(1))
        assertEquals("NEXT", values.getString("state"))
        assertFalse(values.has("deadline"))
    }

    @Test
    fun extrasFillMatchingPromptsCaseInsensitivelyAndTypedByPrompt() {
        val values = CaptureMapper.buildValues(
            calendar,
            create("Dentist", extras = mapOf("when" to "2026-09-21T15:00", "TAGS" to "a, b", "bogus" to "z")),
        )
        assertEquals("2026-09-21", values.getString("When"))
        assertEquals("b", values.getJSONArray("Tags").getString(1))
        assertFalse(values.has("bogus"))
        assertEquals(emptyList<String>(), CaptureMapper.missingRequired(calendar, values))
    }

    @Test
    fun missingRequiredPromptsAreReported() {
        val values = CaptureMapper.buildValues(calendar, create("Dentist"))
        assertEquals(listOf("When"), CaptureMapper.missingRequired(calendar, values))
    }

    @Test
    fun templateWithoutPromptsFallsBackToTitle() {
        val bare = TemplateInfo.fromJson("bare", JSONObject("""{"name":"Bare"}"""))
        assertEquals("Title", bare.titlePrompt)
    }
}
