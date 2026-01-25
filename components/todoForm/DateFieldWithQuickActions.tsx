import { useColorPalette } from "@/context/ColorPaletteContext";
import {
  formatDateForDisplay,
  formatLocalDate,
  formatLocalDateTime,
} from "@/utils/dateFormatting";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Button, IconButton, Switch, Text, useTheme } from "react-native-paper";

function formatDateTimeForApi(date: Date, includeTime: boolean): string {
  if (includeTime) {
    return formatLocalDateTime(date).replace(" ", " "); // YYYY-MM-DD HH:MM format
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
  const [includeTime, setIncludeTime] = useState(initialIncludeTime);

  const handleToday = useCallback(() => {
    const today = new Date();
    today.setSeconds(0, 0);
    // Always set date immediately
    onChange(formatDateTimeForApi(today, false));
    // On mobile, open time picker if includeTime is on
    if (includeTime && Platform.OS !== "web") {
      setTempDate(today);
      setShowTimePicker(true);
    }
  }, [includeTime, onChange]);

  const handleTomorrow = useCallback(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setSeconds(0, 0);
    // Always set date immediately
    onChange(formatDateTimeForApi(tomorrow, false));
    // On mobile, open time picker if includeTime is on
    if (includeTime && Platform.OS !== "web") {
      setTempDate(tomorrow);
      setShowTimePicker(true);
    }
  }, [includeTime, onChange]);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(false);
      if (event.type === "dismissed") {
        return;
      }
      if (date) {
        if (includeTime) {
          setTempDate(date);
          setShowTimePicker(true);
        } else {
          onChange(formatDateTimeForApi(date, false));
        }
      }
    },
    [includeTime, onChange],
  );

  const handleTimeChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowTimePicker(false);
      if (event.type === "dismissed") {
        return;
      }
      if (date) {
        const combined = new Date(tempDate);
        combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
        onChange(formatDateTimeForApi(combined, true));
      }
    },
    [tempDate, onChange],
  );

  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);

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

  if (Platform.OS === "web") {
    return (
      <View style={styles.fieldContainer}>
        <Text variant="bodySmall" style={styles.fieldLabel}>
          {label}
        </Text>
        <View style={styles.quickActionsRow}>
          <Button mode="contained" compact onPress={handleToday}>
            Today
          </Button>
          <Button mode="contained" compact onPress={handleTomorrow}>
            Tomorrow
          </Button>
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
        <View style={styles.dateInputRow}>
          <input
            type="date"
            value={value ? value.split(" ")[0] : ""}
            onChange={(e) => {
              if (e.target.value) {
                // Keep existing time if there was one
                const existingTime = value?.split(" ")[1];
                const newValue = existingTime
                  ? `${e.target.value} ${existingTime}`
                  : e.target.value;
                onChange(newValue);
              }
            }}
            style={{
              flex: 1,
              padding: 12,
              fontSize: 16,
              borderRadius: 4,
              border: `1px solid ${fieldColor}`,
              backgroundColor: "transparent",
            }}
          />
          {includeTime && (
            <input
              type="time"
              value={value?.split(" ")[1] || ""}
              onChange={(e) => {
                const datePart =
                  value?.split(" ")[0] || formatLocalDate(new Date());
                if (e.target.value) {
                  onChange(`${datePart} ${e.target.value}`);
                } else {
                  // Time cleared, just keep date
                  onChange(datePart);
                }
              }}
              style={{
                marginLeft: 8,
                padding: 12,
                fontSize: 16,
                borderRadius: 4,
                border: `1px solid ${fieldColor}`,
                backgroundColor: "transparent",
              }}
            />
          )}
          {value && <IconButton icon="close" size={20} onPress={handleClear} />}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fieldContainer}>
      <Text variant="bodySmall" style={styles.fieldLabel}>
        {label}
      </Text>
      <View style={styles.quickActionsRow}>
        <Button mode="contained" compact onPress={handleToday}>
          Today
        </Button>
        <Button mode="contained" compact onPress={handleTomorrow}>
          Tomorrow
        </Button>
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
      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}
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
  webTimePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
});
