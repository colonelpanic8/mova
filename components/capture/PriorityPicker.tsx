// components/capture/PriorityPicker.tsx
import React from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";

interface PriorityPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  priorities?: string[];
}

const DEFAULT_PRIORITIES = ["A", "B", "C"];

export function PriorityPicker({
  value,
  onChange,
  priorities = DEFAULT_PRIORITIES,
}: PriorityPickerProps) {
  const priorityOptions = [
    { value: null, label: "None" },
    ...priorities.map((p) => ({ value: p, label: p })),
  ];
  return (
    <View style={styles.container}>
      <Text variant="bodySmall" style={styles.label}>
        Priority
      </Text>
      <View style={styles.chips}>
        {priorityOptions.map((p) => (
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
