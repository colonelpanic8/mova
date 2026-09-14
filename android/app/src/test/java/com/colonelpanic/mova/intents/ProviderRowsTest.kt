package com.colonelpanic.mova.intents

import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ProviderRowsTest {

    private val entry = JSONObject(
        """{"todo":"NEXT","title":"Call the bank","tags":["phone","errand"],"level":2,
            "scheduled":{"date":"2026-09-14","time":"10:00","repeater":{"type":"+","value":1,"unit":"w"}},
            "deadline":null,"priority":"A","file":"/data/org/gtd.org","pos":1234,"id":null,
            "olpath":["Finance","Call the bank"],"category":null,"effectiveCategory":"gtd",
            "agendaLine":"  gtd:        10:00...... NEXT Call the bank","dateRelevance":"scheduled"}""",
    )

    @Test
    fun mapsEveryColumn() {
        val row = ProviderRows.row(entry, ProviderRows.ALL_COLUMNS)
        assertArrayEquals(
            arrayOf<Any?>(
                null, "/data/org/gtd.org", 1234, "Call the bank", "NEXT", "A",
                "2026-09-14T10:00", "+1w", null, null,
                "phone,errand", "gtd", "Finance/Call the bank",
                "  gtd:        10:00...... NEXT Call the bank", "scheduled", null,
                "mova://open?file=%2Fdata%2Forg%2Fgtd.org&pos=1234&title=Call+the+bank",
            ),
            row,
        )
    }

    @Test
    fun honoursProjectionOrderAndPrefersIdInOpenUri() {
        val withId = JSONObject(entry.toString()).put("id", "abc-123").put("category", "money")
        val row = ProviderRows.row(withId, arrayOf(ProviderRows.COL_OPEN_URI, ProviderRows.COL_CATEGORY, "nope"))
        assertEquals("mova://open?id=abc-123", row[0])
        assertEquals("money", row[1])
        assertNull(row[2])
    }
}
