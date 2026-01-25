/**
 * Time formatting utilities
 * Consolidates functions for formatting times and relative time displays
 */

/**
 * Format an hour number to 12-hour display format (e.g., "9 AM", "12 PM")
 */
export function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${displayHour} ${period}`;
}

/**
 * Format hours and minutes to 12-hour display format (e.g., "9:30 AM")
 */
export function formatTime(hours: number, minutes: number): string {
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const displayMinutes = minutes.toString().padStart(2, "0");
  return `${displayHour}:${displayMinutes} ${period}`;
}

/**
 * Format a Timestamp for display (short format)
 * Shows "Jan 15" for date-only, "Jan 15, 9:30 AM" for datetime
 */
export function formatTimestampShort(ts: {
  date: string;
  time?: string;
}): string {
  const hasTime = !!ts.time;
  // Parse as local time to avoid timezone shift
  const dateStr = hasTime ? `${ts.date}T${ts.time}:00` : `${ts.date}T00:00:00`;
  const date = new Date(dateStr);

  if (hasTime) {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Format a completion timestamp for display (time only)
 */
export function formatCompletedAt(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format relative time (e.g., "in 30 minutes", "in 2 hours")
 */
export function formatTimeUntil(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) return `in ${hours} hour${hours > 1 ? "s" : ""}`;
  return `in ${hours}h ${remainingMins}m`;
}

/**
 * Format a Date object for time-only display
 */
export function formatTimeFromDate(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
