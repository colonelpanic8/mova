// components/capture/StatePicker.tsx
import { useTemplates } from "@/context/TemplatesContext";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";

interface StatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function StatePicker({ value, onChange }: StatePickerProps) {
  const { todoStates } = useTemplates();

  const allStates = todoStates
    ? [...todoStates.active, ...todoStates.done]
    : ["TODO", "NEXT", "WAITING", "DONE"];

  return (
    <View style={styles.container}>
      <Text variant="bodySmall" style={styles.label}>
        State
      </Text>
      <View style={styles.chips}>
        {allStates.map((state) => (
          <Chip
            key={state}
            selected={value === state}
            onPress={() => onChange(state)}
            style={styles.chip}
            compact
          >
            {state}
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
