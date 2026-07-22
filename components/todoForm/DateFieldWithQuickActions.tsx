import { ActionButton } from "@/components/ActionButton";
import { PlatformDatePicker } from "@/components/PlatformDatePicker";
import { useColorPalette } from "@/context/ColorPaletteContext";
import {
  formatDateForDisplay,
  formatLocalDate,
  formatLocalDateTime,
  formatLocalTime,
} from "@/utils/dateFormatting";
import { parseFormString } from "@/utils/timestampConversion";
import React, { useCallback, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Button, IconButton, Switch, Text, useTheme } from "react-native-paper";

function formatDateTimeForApi(date: Date, includeTime: boolean): string {
  if (includeTime) {
    return formatLocalDateTime(date).replace(" ", "T"); // YYYY-MM-DDTHH:MM format
  }
  return formatLocalDate(date);
}

export interface DateFieldWithQuickActionsProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colorKey: "schedule" | "deadline";
  includeTime: boolean;
}

export function DateFieldWithQuickActions({
  label,
  value,
  onChange,
  colorKey,
  includeTime: initialIncludeTime,
}: DateFieldWithQuickActionsProps) {
  const theme = useTheme();
  const { getActionColor } = useColorPalette();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  // Auto-detect if existing value has time, otherwise use initial setting
  const valueHasTime = value
    ? value.includes("T") || value.includes(" ")
    : false;
  const [includeTime, setIncludeTime] = useState(
    initialIncludeTime || valueHasTime,
  );

  const setQuickDate = useCallback(
    (date: Date) => {
      date.setSeconds(0, 0);
      // Always set date immediately
      onChange(formatDateTimeForApi(date, false));
      // On mobile, open time picker if includeTime is on
      if (includeTime && Platform.OS !== "web") {
        setTempDate(date);
        setShowTimePicker(true);
      }
    },
    [includeTime, onChange],
  );

  const handleTomorrow = useCallback(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setQuickDate(tomorrow);
  }, [setQuickDate]);

  const handleDatePicked = useCallback(
    (date: Date) => {
      setShowDatePicker(false);
      if (includeTime) {
        setTempDate(date);
        setShowTimePicker(true);
      } else {
        onChange(formatDateTimeForApi(date, false));
      }
    },
    [includeTime, onChange],
  );

  const handleTimePicked = useCallback(
    (combined: Date) => {
      setShowTimePicker(false);
      onChange(formatDateTimeForApi(combined, true));
    },
    [onChange],
  );

  const handleOpenPicker = useCallback(() => {
    if (value) {
      const date =
        value.includes("T") || value.includes(" ")
          ? new Date(value.replace(" ", "T"))
          : new Date(value + "T00:00:00");
      setTempDate(date);
    } else {
      setTempDate(new Date());
    }
    setShowDatePicker(true);
  }, [value]);

  const fieldColor = getActionColor(colorKey);
  const { datePart, timePart } = parseFormString(value);
  const handleClear = () => onChange("");
  const webInputStyle: React.CSSProperties = {
    borderRadius: 4,
    borderColor: fieldColor,
    backgroundColor: "transparent",
    marginBottom: 0,
  };

  return (
    <View style={styles.fieldContainer}>
      <Text variant="bodySmall" style={styles.fieldLabel}>
        {label}
      </Text>
      <View style={styles.quickActionsRow}>
        <ActionButton onPress={() => setQuickDate(new Date())}>
          Today
        </ActionButton>
        <ActionButton onPress={handleTomorrow}>Tomorrow</ActionButton>
        <View style={styles.timeToggle}>
          <Text
            style={[
              styles.timeToggleLabel,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Time
          </Text>
          <Switch value={includeTime} onValueChange={setIncludeTime} />
        </View>
      </View>

      {Platform.OS === "web" ? (
        // Web: inline date (+ optional time) inputs
        <View style={styles.dateInputRow}>
          <PlatformDatePicker
            mode="date"
            webInline
            visible
            value={datePart ? new Date(datePart + "T00:00:00") : null}
            onChange={(date) => {
              // Keep existing time if there was one
              const newDatePart = formatLocalDate(date);
              onChange(timePart ? `${newDatePart}T${timePart}` : newDatePart);
            }}
            onDismiss={() => {}}
            webInlineStyle={{ flex: 1, ...webInputStyle }}
          />
          {includeTime && (
            <PlatformDatePicker
              mode="time"
              webInline
              visible
              value={timePart ? new Date(`${datePart}T${timePart}`) : null}
              onChange={(picked) => {
                const currentDatePart = datePart || formatLocalDate(new Date());
                onChange(`${currentDatePart}T${formatLocalTime(picked)}`);
              }}
              onDismiss={() => {}}
              webInlineStyle={{ marginLeft: 8, ...webInputStyle }}
            />
          )}
          {value && <IconButton icon="close" size={20} onPress={handleClear} />}
        </View>
      ) : (
        // Native: button opens a date picker, then a time picker if enabled
        <View style={styles.dateButtonRow}>
          <Button
            mode="outlined"
            onPress={handleOpenPicker}
            style={[styles.dateButton, { borderColor: fieldColor }]}
            icon="calendar"
          >
            {value ? formatDateForDisplay(value) : `Select ${label}`}
          </Button>
          {value && (
            <IconButton
              icon="close"
              size={20}
              onPress={handleClear}
              style={styles.clearButtonInline}
            />
          )}
        </View>
      )}

      <PlatformDatePicker
        mode="date"
        visible={showDatePicker}
        value={tempDate}
        onChange={handleDatePicked}
        onDismiss={() => setShowDatePicker(false)}
      />
      <PlatformDatePicker
        mode="time"
        visible={showTimePicker}
        value={tempDate}
        onChange={handleTimePicked}
        onDismiss={() => setShowTimePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  quickActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  dateInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateButtonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateButton: {
    flex: 1,
  },
  clearButtonInline: {
    marginLeft: -8,
  },
  timeToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    gap: 4,
  },
  timeToggleLabel: {
    fontSize: 13,
  },
});
