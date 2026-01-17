// components/capture/PriorityPicker.tsx
import React from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";

interface PriorityPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const PRIORITIES = [
  { value: null, label: "None" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  return (
    <View style={styles.container}>
      <Text variant="bodySmall" style={styles.label}>
        Priority
      </Text>
      <View style={styles.chips}>
        {PRIORITIES.map((p) => (
          <Chip
            key={p.label}
            selected={value === p.value}
            onPress={() => onChange(p.value)}
            style={styles.chip}
            compact
          >
            {p.label}
          </Chip>
        ))}
      </View>
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
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {},
});
