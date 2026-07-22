import { formatLocalDate } from "@/utils/dateFormatting";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Platform } from "react-native";
import { useTheme } from "react-native-paper";

export type PlatformDatePickerMode = "date" | "time" | "datetime";

export interface PlatformDatePickerProps {
  /** Which part(s) of the date to pick. */
  mode: PlatformDatePickerMode;
  /**
   * Current value. Time pickers combine the picked time into this date, so
   * `onChange` always receives a full Date.
   */
  value: Date;
  /** Render (and on native/hidden web, immediately open) the picker. */
  visible: boolean;
  /** Called with the updated Date when the user picks a value. */
  onChange: (date: Date) => void;
  /** Called when the user cancels/dismisses the picker. */
  onDismiss: () => void;
  /**
   * Web only: render a visible, styled input inline instead of a hidden input
   * that auto-opens the browser's picker.
   */
  webInline?: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function toWebInputValue(mode: PlatformDatePickerMode, value: Date): string {
  switch (mode) {
    case "date":
      return formatLocalDate(value);
    case "time":
      return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
    case "datetime":
      return `${formatLocalDate(value)}T${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }
}

function parseWebInputValue(
  mode: PlatformDatePickerMode,
  raw: string,
  base: Date,
): Date | null {
  if (!raw) return null;
  if (mode === "time") {
    const [hours, minutes] = raw.split(":").map(Number);
    const combined = new Date(base);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  }
  const parsed = new Date(mode === "date" ? `${raw}T00:00:00` : raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

const webInputTypes: Record<PlatformDatePickerMode, string> = {
  date: "date",
  time: "time",
  datetime: "datetime-local",
};

/**
 * Cross-platform date/time picker: native DateTimePicker on iOS/Android, an
 * `<input>` on web. By default the web input is hidden and opens the browser
 * picker immediately (matching the native "picker pops up" behavior); pass
 * `webInline` to render it as a regular styled form field instead.
 *
 * Android has no combined datetime picker, so `mode="datetime"` falls back to
 * a date step followed by a time step there.
 */
export function PlatformDatePicker({
  mode,
  value,
  visible,
  onChange,
  onDismiss,
  webInline = false,
}: PlatformDatePickerProps) {
  const theme = useTheme();
  // Android datetime fallback state: which step we're on and the picked date.
  const [androidTimeStep, setAndroidTimeStep] = useState<Date | null>(null);

  if (!visible) {
    if (androidTimeStep) setAndroidTimeStep(null);
    return null;
  }

  if (Platform.OS === "web") {
    return (
      <input
        type={webInputTypes[mode]}
        value={toWebInputValue(mode, value)}
        onChange={(e) => {
          const parsed = parseWebInputValue(mode, e.target.value, value);
          if (parsed) {
            onChange(parsed);
          }
        }}
        onBlur={webInline ? undefined : onDismiss}
        ref={
          webInline
            ? undefined
            : (el) => {
                // Auto-open the picker when mounted
                if (el) {
                  try {
                    el.showPicker();
                  } catch {
                    // Fallback: just focus if showPicker not supported
                    el.focus();
                  }
                }
              }
        }
        style={
          webInline
            ? {
                padding: 12,
                fontSize: 16,
                borderRadius: 8,
                border: `1px solid ${theme.colors.outline}`,
                marginBottom: 8,
              }
            : {
                position: "absolute",
                opacity: 0,
                pointerEvents: "none",
              }
        }
      />
    );
  }

  const useAndroidDatetimeFallback =
    mode === "datetime" && Platform.OS === "android";
  const nativeMode = useAndroidDatetimeFallback
    ? androidTimeStep
      ? "time"
      : "date"
    : mode;

  const handleNativeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "dismissed") {
      setAndroidTimeStep(null);
      onDismiss();
      return;
    }
    if (!date) return;

    if (nativeMode === "time") {
      const base = androidTimeStep ?? value;
      const combined = new Date(base);
      combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setAndroidTimeStep(null);
      onChange(combined);
    } else if (useAndroidDatetimeFallback) {
      // Date step done; keep the time-of-day from value and ask for the time.
      const merged = new Date(value);
      merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setAndroidTimeStep(merged);
    } else {
      onChange(date);
    }
  };

  return (
    <DateTimePicker
      value={androidTimeStep ?? value}
      mode={nativeMode}
      display="default"
      onChange={handleNativeChange}
    />
  );
}

export default PlatformDatePicker;
