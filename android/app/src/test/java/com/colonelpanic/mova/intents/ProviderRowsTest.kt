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
                0, null, null, null,
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

    @Test
    fun mapsHabitDecisionsAndPreservesStructuredSummary() {
        val summary = JSONObject(
            """{
                "conformingRatio":0.75,
                "aggregatedConformingRatio":0.8,
                "completionNeededToday":true,
                "nextRequiredInterval":"2026-09-15",
                "completionsInWindow":3,
                "targetRepetitions":4,
                "windowSpecsStatus":[{
                    "conformingRatio":0.75,
                    "completionsInWindow":3,
                    "targetRepetitions":4,
                    "duration":{"days":7},
                    "conformingValue":1,
                    "windowStart":"2026-09-08",
                    "windowEnd":"2026-09-14"
                }],
                "miniGraph":[{
                    "date":"2026-09-14",
                    "conformingRatio":0.75,
                    "completed":false,
                    "completionNeededToday":true,
                    "conformingRatioWith":1.0
                }]
            }""",
        )
        val habit = JSONObject(entry.toString())
            .put("isWindowHabit", true)
            .put("habitCompletedOnQueryDate", false)
            .put("habitSummary", summary)

        val row = ProviderRows.row(
            habit,
            arrayOf(
                ProviderRows.COL_IS_WINDOW_HABIT,
                ProviderRows.COL_HABIT_COMPLETED_ON_QUERY_DATE,
                ProviderRows.COL_HABIT_COMPLETION_NEEDED_TODAY,
                ProviderRows.COL_HABIT_SUMMARY_JSON,
            ),
        )

        assertEquals(1, row[0])
        assertEquals(0, row[1])
        assertEquals(1, row[2])
        val mappedSummary = JSONObject(row[3] as String)
        assertEquals("2026-09-15", mappedSummary.getString("nextRequiredInterval"))
        assertEquals(0.8, mappedSummary.getDouble("aggregatedConformingRatio"), 0.0)
        val windowStatus = mappedSummary.getJSONArray("windowSpecsStatus").getJSONObject(0)
        assertEquals(7, windowStatus.getJSONObject("duration").getInt("days"))
        val graphEntry = mappedSummary.getJSONArray("miniGraph").getJSONObject(0)
        assertEquals("2026-09-14", graphEntry.getString("date"))

        val completedRow = ProviderRows.row(
            JSONObject(habit.toString()).put("habitCompletedOnQueryDate", true),
            arrayOf(ProviderRows.COL_HABIT_COMPLETED_ON_QUERY_DATE),
        )
        assertEquals(1, completedRow[0])
    }

    @Test
    fun mapsNonHabitAndUnavailableHabitStatusWithoutInventingValues() {
        val nonHabit = JSONObject(entry.toString())
            .put("isWindowHabit", false)
            .put("habitCompletedOnQueryDate", JSONObject.NULL)
            .put("habitSummary", JSONObject.NULL)

        val row = ProviderRows.row(
            nonHabit,
            arrayOf(
                ProviderRows.COL_IS_WINDOW_HABIT,
                ProviderRows.COL_HABIT_COMPLETED_ON_QUERY_DATE,
                ProviderRows.COL_HABIT_COMPLETION_NEEDED_TODAY,
                ProviderRows.COL_HABIT_SUMMARY_JSON,
            ),
        )

        assertEquals(0, row[0])
        assertNull(row[1])
        assertNull(row[2])
        assertNull(row[3])
    }
}
