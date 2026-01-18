/**
 * Repeater Picker Component
 *
 * Allows setting repeater for scheduled/deadline timestamps.
 * Supports org-mode repeater types: +, ++, .+
 */

import { Repeater, RepeaterType, RepeaterUnit } from "@/services/api";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  IconButton,
  Menu,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

interface RepeaterPickerProps {
  value: Repeater | null;
  onChange: (repeater: Repeater | null) => void;
  label?: string;
}

const REPEATER_TYPES: {
  value: RepeaterType;
  label: string;
  description: string;
}[] = [
  {
    value: "+",
    label: "Cumulative (+)",
    description: "Next on fixed schedule",
  },
  { value: "++", label: "Catch-up (++)", description: "Shift from today" },
  { value: ".+", label: "Restart (.+)", description: "Shift from completion" },
];

const REPEATER_UNITS: { value: RepeaterUnit; label: string }[] = [
  { value: "d", label: "day" },
  { value: "w", label: "week" },
  { value: "m", label: "month" },
  { value: "y", label: "year" },
];

export function formatRepeaterDisplay(repeater: Repeater | null): string {
  if (!repeater) return "No repeat";
  const unitLabel =
    REPEATER_UNITS.find((u) => u.value === repeater.unit)?.label ||
    repeater.unit;
  const plural = repeater.value !== 1 ? "s" : "";
  return `Every ${repeater.value} ${unitLabel}${plural}`;
}

export function RepeaterPicker({
  value,
  onChange,
  label,
}: RepeaterPickerProps) {
  const theme = useTheme();
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);

  const handleTypeChange = (type: RepeaterType) => {
    if (value) {
      onChange({ ...value, type });
    } else {
      onChange({ type, value: 1, unit: "w" });
    }
    setTypeMenuVisible(false);
  };

  const handleValueChange = (text: string) => {
    const num = parseInt(text, 10);
    if (!isNaN(num) && num > 0 && num < 100) {
      if (value) {
        onChange({ ...value, value: num });
      } else {
        onChange({ type: "+", value: num, unit: "w" });
      }
    }
  };

  const handleUnitChange = (unit: RepeaterUnit) => {
    if (value) {
      onChange({ ...value, unit });
    } else {
      onChange({ type: "+", value: 1, unit });
    }
    setUnitMenuVisible(false);
  };

  const handleClear = () => {
    onChange(null);
  };

  const handleEnable = () => {
    onChange({ type: "+", value: 1, unit: "w" });
  };

  const currentType = REPEATER_TYPES.find((t) => t.value === value?.type);
  const currentUnit = REPEATER_UNITS.find((u) => u.value === value?.unit);

  if (!value) {
    return (
      <View style={styles.container}>
        {label && (
          <Text
            variant="labelMedium"
            style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
          >
            {label}
          </Text>
        )}
        <Button mode="outlined" onPress={handleEnable} icon="repeat">
          Add Repeat
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {label && (
        <Text
          variant="labelMedium"
          style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
        >
          {label}
        </Text>
      )}
      <View style={styles.row}>
        <Menu
          visible={typeMenuVisible}
          onDismiss={() => setTypeMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setTypeMenuVisible(true)}
              style={styles.typeButton}
              compact
            >
              {currentType?.label || "Type"}
            </Button>
          }
        >
          {REPEATER_TYPES.map((type) => (
            <Menu.Item
              key={type.value}
              onPress={() => handleTypeChange(type.value)}
              title={type.label}
              leadingIcon={value?.type === type.value ? "check" : undefined}
            />
          ))}
        </Menu>

        <Text style={[styles.everyLabel, { color: theme.colors.onSurface }]}>
          Every
        </Text>

        <TextInput
          mode="outlined"
          value={value.value.toString()}
          onChangeText={handleValueChange}
          keyboardType="number-pad"
          style={styles.valueInput}
          dense
        />

        <Menu
          visible={unitMenuVisible}
          onDismiss={() => setUnitMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setUnitMenuVisible(true)}
              style={styles.unitButton}
              compact
            >
              {currentUnit?.label || "unit"}
            </Button>
          }
        >
          {REPEATER_UNITS.map((unit) => (
            <Menu.Item
              key={unit.value}
              onPress={() => handleUnitChange(unit.value)}
              title={unit.label}
              leadingIcon={value?.unit === unit.value ? "check" : undefined}
            />
          ))}
        </Menu>

        <IconButton
          icon="close"
          size={20}
          onPress={handleClear}
          style={styles.clearButton}
        />
      </View>
      <Text
        variant="bodySmall"
        style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
      >
        {currentType?.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeButton: {
    minWidth: 100,
  },
  everyLabel: {
    marginHorizontal: 4,
  },
  valueInput: {
    width: 60,
    textAlign: "center",
  },
  unitButton: {
    minWidth: 80,
  },
  clearButton: {
    marginLeft: "auto",
  },
  description: {
    marginTop: 4,
    fontStyle: "italic",
  },
});
