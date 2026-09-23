package com.colonelpanic.mova.eva

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EvaSchemaTest {

    private val schema = EvaSchema.of(
        EvaSchema.Str("title", "t", required = true),
        EvaSchema.Int64("pos", "p", minimum = 1, maximum = 100),
        EvaSchema.Bool("flag", "f"),
        EvaSchema.StrArray("tags", "g", maxItems = 4, maxLength = 20),
        EvaSchema.StrMap("prompts", "m", maxProperties = 4, maxLength = 20),
    )

    @Test
    fun automationStringsBecomeDeclaredTypes() {
        val args = schema.coerce(
            mapOf(
                "title" to "Taxes",
                "pos" to "12",
                "flag" to "true",
                "tags" to "home, errands",
                "prompts" to mapOf("Who" to "Ana"),
            ),
        )
        assertNull(schema.check(args))
        assertEquals(12L, args.get("pos"))
        assertEquals(true, args.get("flag"))
        assertEquals(2, args.getJSONArray("tags").length())
        assertEquals("Ana", args.getJSONObject("prompts").getString("Who"))
    }

    @Test
    fun unconvertibleValuesStillFailValidation() {
        val args = schema.coerce(mapOf("title" to "Taxes", "pos" to "twelve", "extra" to "x"))
        assertTrue(schema.check(args)!!.contains("extra"))
        assertTrue(schema.check(schema.coerce(mapOf("title" to "Taxes", "pos" to "twelve")))!!.contains("pos"))
    }
}
