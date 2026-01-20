import { useColorPalette } from "@/context/ColorPaletteContext";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useState } from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Button,
  IconButton,
  Text,
} from "react-native-paper";

function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateForDisplay(dateString: string): string {
  if (dateString.includes("T") || dateString.includes(" ")) {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTimeForApi(date: Date, includeTime: boolean): string {
  if (includeTime) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
  return formatDateForApi(date);
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
  includeTime,
}: DateFieldWithQuickActionsProps) {
  const { getActionColor } = useColorPalette();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const handleToday = useCallback(() => {
    const today = new Date();
    if (includeTime) {
      const minutes = Math.ceil(today.getMinutes() / 15) * 15;
      today.setMinutes(minutes, 0, 0);
      if (Platform.OS === "web") {
        onChange(formatDateTimeForApi(today, true));
      } else {
        setTempDate(today);
        setShowTimePicker(true);
      }
    } else {
      onChange(formatDateTimeForApi(today, false));
    }
  }, [includeTime, onChange]);

  const handleTomorrow = useCallback(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (includeTime) {
      tomorrow.setHours(9, 0, 0, 0);
      if (Platform.OS === "web") {
        onChange(formatDateTimeForApi(tomorrow, true));
      } else {
        setTempDate(tomorrow);
        setShowTimePicker(true);
      }
    } else {
      onChange(formatDateTimeForApi(tomorrow, false));
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

  const todayColor = getActionColor("today");
  const tomorrowColor = getActionColor("tomorrow");
  const fieldColor = getActionColor(colorKey);

  if (Platform.OS === "web") {
    return (
      <View style={styles.fieldContainer}>
        <Text variant="bodySmall" style={styles.fieldLabel}>
          {label}
        </Text>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: todayColor }]}
            onPress={handleToday}
          >
            <Text style={styles.quickActionText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              { backgroundColor: tomorrowColor },
            ]}
            onPress={handleTomorrow}
          >
            <Text style={styles.quickActionText}>Tomorrow</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dateInputRow}>
          <input
            type={includeTime ? "datetime-local" : "date"}
            value={
              includeTime && value
                ? value.replace(" ", "T")
                : value.split(" ")[0] || ""
            }
            onChange={(e) => {
              if (e.target.value) {
                const newValue = includeTime
                  ? e.target.value.replace("T", " ")
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
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: todayColor }]}
          onPress={handleToday}
        >
          <Text style={styles.quickActionText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: tomorrowColor }]}
          onPress={handleTomorrow}
        >
          <Text style={styles.quickActionText}>Tomorrow</Text>
        </TouchableOpacity>
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
    gap: 8,
    marginBottom: 8,
  },
  quickActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickActionText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
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
});
