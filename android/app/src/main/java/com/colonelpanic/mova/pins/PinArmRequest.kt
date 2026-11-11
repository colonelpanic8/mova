package com.colonelpanic.mova.pins

/** Arguments of the content provider's `arm_pin` call. */
data class PinArmRequest(
  val title: String,
  /** Negative means the stored default reminder. */
  val escalateMinutes: Int,
  val nagMinutes: Int,
  val key: String?,
) {
  companion object {
    const val TITLE = "title"
    const val ESCALATE_MINUTES = "escalate_minutes"
    const val NAG_MINUTES = "nag_minutes"
    const val KEY = "key"

    /**
     * Automation apps often send every extra as a string, so integers are
     * accepted in either form.
     *
     * @throws IllegalArgumentException naming the offending argument.
     */
    fun parse(values: Map<String, Any?>): PinArmRequest {
      val title = values[TITLE]?.toString()?.trim().orEmpty()
      require(title.isNotEmpty()) { "$TITLE is required" }
      return PinArmRequest(
        title = title,
        escalateMinutes = minutes(values, ESCALATE_MINUTES, minimum = 0) ?: -1,
        nagMinutes = minutes(values, NAG_MINUTES, minimum = 1) ?: DEFAULT_NAG_MINUTES,
        key = values[KEY]?.toString()?.trim()?.takeIf { it.isNotEmpty() },
      )
    }

    private fun minutes(values: Map<String, Any?>, name: String, minimum: Int): Int? {
      val raw = values[name] ?: return null
      val parsed = (raw as? Number)?.toInt() ?: raw.toString().trim().toIntOrNull()
      require(parsed != null && parsed >= minimum) { "$name must be an integer of at least $minimum" }
      return parsed
    }
  }
}
