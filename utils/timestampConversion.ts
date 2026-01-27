/**
 * Timestamp conversion utilities
 * Consolidates functions for converting between Date, string, and Timestamp objects
 */

import { Repeater, Timestamp } from "@/services/api";
import { formatLocalDate, formatLocalTime } from "./dateFormatting";

/**
 * Convert a Date object to a Timestamp object
 *
 * @param date - The Date to convert
 * @param includeTime - Whether to include time in the Timestamp
 * @returns Timestamp object with date and optional time
 */
export function dateToTimestamp(date: Date, includeTime: boolean): Timestamp {
  const timestamp: Timestamp = { date: formatLocalDate(date) };
  if (includeTime) {
    timestamp.time = formatLocalTime(date);
  }
  return timestamp;
}

/**
 * Convert a Timestamp object to a Date
 *
 * @param ts - The Timestamp to convert (or null)
 * @returns Date object or null if input is null
 */
export function timestampToDate(ts: Timestamp | null): Date | null {
  if (!ts) return null;
  const dateStr = ts.time ? `${ts.date}T${ts.time}:00` : `${ts.date}T00:00:00`;
  return new Date(dateStr);
}

/**
 * Convert a Timestamp to a form string (YYYY-MM-DD or YYYY-MM-DDTHH:MM)
 * Used for form inputs that work with string dates
 *
 * @param ts - The Timestamp to convert (or null)
 * @returns Form string or empty string if input is null
 */
export function timestampToFormString(ts: Timestamp | null): string {
  if (!ts) return "";
  if (ts.time) {
    return `${ts.date}T${ts.time}`;
  }
  return ts.date;
}

/**
 * Parse a form string into date and time parts.
 * Handles both "T" separator (ISO format) and space separator (web inputs).
 *
 * @param dateStr - Date string in YYYY-MM-DD, YYYY-MM-DDTHH:MM, or "YYYY-MM-DD HH:MM" format
 * @returns Object with datePart and timePart (empty strings if not present)
 */
export function parseFormString(
  dateStr: string | undefined,
): { datePart: string; timePart: string } {
  if (!dateStr) return { datePart: "", timePart: "" };

  const separator = dateStr.includes("T") ? "T" : " ";
  const parts = dateStr.split(separator);
  const datePart = parts[0] || "";
  const timePart = parts[1] || "";

  // Only return time if it looks like a valid time (HH:MM format)
  if (timePart && timePart.match(/^\d{2}:\d{2}/)) {
    return { datePart, timePart };
  }
  return { datePart, timePart: "" };
}

/**
 * Convert a form string + optional repeater to a Timestamp object
 *
 * @param dateStr - Date string in YYYY-MM-DD or YYYY-MM-DDTHH:MM format
 * @param repeater - Optional repeater to include in the Timestamp
 * @returns Timestamp object or null if input is empty
 */
export function formStringToTimestamp(
  dateStr: string,
  repeater: Repeater | null,
): Timestamp | null {
  if (!dateStr) return null;

  const { datePart, timePart } = parseFormString(dateStr);
  const ts: Timestamp = { date: datePart };

  if (timePart) {
    ts.time = timePart;
  }

  if (repeater) {
    ts.repeater = repeater;
  }

  return ts;
}

/**
 * Build a datetime string from a Timestamp object
 * Used for creating Date objects or comparing times
 *
 * @param ts - The Timestamp
 * @returns ISO-like datetime string
 */
export function timestampToDateTimeString(ts: Timestamp): string {
  return ts.time ? `${ts.date}T${ts.time}:00` : `${ts.date}T00:00:00`;
}
