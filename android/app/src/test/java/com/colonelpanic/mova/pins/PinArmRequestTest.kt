package com.colonelpanic.mova.pins

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class PinArmRequestTest {
  @Test
  fun stringExtrasFromAutomationAppsAreCoerced() {
    assertEquals(
      PinArmRequest(title = "Bring scooter in", escalateMinutes = 10, nagMinutes = 10, key = "scooter"),
      PinArmRequest.parse(
        mapOf("title" to " Bring scooter in ", "escalate_minutes" to "10", "nag_minutes" to 10, "key" to "scooter"),
      ),
    )
  }

  @Test
  fun omittedTimingFallsBackToTheStoredReminderAndDefaultNag() {
    assertEquals(
      PinArmRequest(title = "Stove", escalateMinutes = -1, nagMinutes = 5, key = null),
      PinArmRequest.parse(mapOf("title" to "Stove", "key" to " ")),
    )
  }

  @Test
  fun unusableArgumentsAreRejectedByName() {
    assertEquals(
      "title is required",
      assertThrows(IllegalArgumentException::class.java) { PinArmRequest.parse(mapOf("title" to "  ")) }.message,
    )
    assertEquals(
      "nag_minutes must be an integer of at least 1",
      assertThrows(IllegalArgumentException::class.java) {
        PinArmRequest.parse(mapOf("title" to "Stove", "nag_minutes" to "0"))
      }.message,
    )
    assertEquals(
      "escalate_minutes must be an integer of at least 0",
      assertThrows(IllegalArgumentException::class.java) {
        PinArmRequest.parse(mapOf("title" to "Stove", "escalate_minutes" to "soon"))
      }.message,
    )
  }
}
