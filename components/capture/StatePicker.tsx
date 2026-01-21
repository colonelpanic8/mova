// components/capture/StatePicker.tsx
import { useColorPalette } from "@/context/ColorPaletteContext";
import { useTemplates } from "@/context/TemplatesContext";
import { getContrastColor } from "@/utils/color";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Divider, Text, useTheme } from "react-native-paper";

interface StatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function StatePicker({ value, onChange }: StatePickerProps) {
  const theme = useTheme();
  const { todoStates } = useTemplates();
  const { getTodoStateColor } = useColorPalette();

  const activeStates = todoStates?.active || ["TODO", "NEXT", "WAITING"];
  const doneStates = todoStates?.done || ["DONE"];

  const renderChip = (state: string) => {
    const isSelected = value === state;
    const stateColor = getTodoStateColor(state);
    const textColor = getContrastColor(stateColor);

    return (
      <Chip
        key={state}
        selected={isSelected}
        onPress={() => onChange(state)}
        style={[
          styles.chip,
          {
            backgroundColor: isSelected ? stateColor : "transparent",
            borderColor: stateColor,
            borderWidth: 1.5,
          },
        ]}
        textStyle={{
          color: isSelected ? textColor : stateColor,
          fontWeight: isSelected ? "600" : "500",
        }}
        compact
      >
        {state}
      </Chip>
    );
  };

  return (
    <View style={styles.container}>
      <Text variant="bodySmall" style={styles.label}>
        State
      </Text>

      {/* Active states */}
      <Text
        variant="labelSmall"
        style={[styles.groupLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        Active
      </Text>
      <View style={styles.chips}>{activeStates.map(renderChip)}</View>

      <Divider style={styles.divider} />

      {/* Done states */}
      <Text
        variant="labelSmall"
        style={[styles.groupLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        Completed
      </Text>
      <View style={styles.chips}>{doneStates.map(renderChip)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    opacity: 0.7,
  },
  groupLabel: {
    marginBottom: 6,
    marginTop: 4,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {},
  divider: {
    marginVertical: 12,
  },
});
