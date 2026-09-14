package com.colonelpanic.mova.intents

import org.json.JSONArray
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TemplateProviderRowsTest {

    private val template = TemplateInfo(
        key = "capture work",
        name = "Work task",
        prompts = listOf(
            TemplatePrompt("Title", "string", true),
            TemplatePrompt("Project", "string", false),
            TemplatePrompt("When", "date", true),
        ),
    )

    @Test
    fun mapsEveryColumn() {
        val row = TemplateProviderRows.row(
            template,
            TemplateProviderRows.ALL_COLUMNS,
            defaultTemplate = "capture work",
        )

        assertArrayEquals(
            arrayOf<Any?>(
                "capture work",
                "Work task",
                1,
                "Title",
                """[{"name":"Title","type":"string","required":true},{"name":"Project","type":"string","required":false},{"name":"When","type":"date","required":true}]""",
                "mova://capture?template=capture+work",
            ),
            row,
        )
        assertEquals(3, JSONArray(row[4] as String).length())
    }

    @Test
    fun honoursProjectionOrderAndMarksNonDefault() {
        val row = TemplateProviderRows.row(
            template,
            arrayOf(TemplateProviderRows.COL_CAPTURE_URI, TemplateProviderRows.COL_IS_DEFAULT, "nope"),
            defaultTemplate = "other",
        )

        assertEquals("mova://capture?template=capture+work", row[0])
        assertEquals(0, row[1])
        assertNull(row[2])
    }
}
