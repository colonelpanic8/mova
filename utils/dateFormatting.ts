/**
 * Date formatting utilities
 * Consolidates date formatting functions used throughout the app
 */

/**
 * Format a Date to YYYY-MM-DD using local time (not UTC).
 * This avoids off-by-one errors that occur when using toISOString().
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date to HH:MM using local time
 */
export function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Format a Date to YYYY-MM-DD HH:MM using local time
 */
export function formatLocalDateTime(date: Date): string {
  return `${formatLocalDate(date)} ${formatLocalTime(date)}`;
}

/**
 * Format a date string for display.
 * Handles both date-only (YYYY-MM-DD) and datetime strings.
 *
 * @param dateString - Date string in YYYY-MM-DD or YYYY-MM-DDTHH:MM format
 * @param optionsOrCompact - Either boolean for compact mode, or options object
 */
export function formatDateForDisplay(
  dateString: string,
  optionsOrCompact: boolean | { compact?: boolean; includeTime?: boolean } = {},
): string {
  // Support both boolean (legacy) and object (new) parameter styles
  const options =
    typeof optionsOrCompact === "boolean"
      ? { compact: optionsOrCompact }
      : optionsOrCompact;
  const { compact = false, includeTime = true } = options;

  // Check if the string includes time
  const hasTime =
    includeTime && (dateString.includes("T") || dateString.includes(" "));

  if (hasTime) {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Parse date-only strings as local time to avoid timezone shift
  const date = new Date(dateString + "T00:00:00");

  if (compact) {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date for long display (with weekday)
 */
export function formatDateLong(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Check if a date is in the past (before today)
 */
export function isPastDay(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate < today;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
