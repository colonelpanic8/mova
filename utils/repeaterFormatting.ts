/**
 * Repeater formatting utilities
 * Consolidates functions for formatting org-mode repeater displays
 */

import { Repeater } from "@/services/api";

const UNIT_LABELS: Record<string, string> = {
  d: "day",
  w: "week",
  m: "month",
  y: "year",
};

/**
 * Format a repeater for compact display (e.g., "1 week", "2 days")
 */
export function formatRepeater(repeater: Repeater): string {
  const unitLabel = UNIT_LABELS[repeater.unit] || repeater.unit;
  const plural = repeater.value !== 1 ? "s" : "";
  return `${repeater.value} ${unitLabel}${plural}`;
}

/**
 * Format a repeater for display with "Every" prefix (e.g., "Every 1 week")
 * Returns "No repeat" if repeater is null
 */
export function formatRepeaterDisplay(repeater: Repeater | null): string {
  if (!repeater) return "No repeat";
  const unitLabel = UNIT_LABELS[repeater.unit] || repeater.unit;
  const plural = repeater.value !== 1 ? "s" : "";
  return `Every ${repeater.value} ${unitLabel}${plural}`;
}
