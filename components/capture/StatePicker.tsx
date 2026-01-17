// components/capture/StatePicker.tsx
import { api, TodoStatesResponse } from "@/services/api";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";

interface StatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function StatePicker({ value, onChange }: StatePickerProps) {
  const [states, setStates] = useState<TodoStatesResponse | null>(null);

  useEffect(() => {
    api.getTodoStates().then(setStates).catch(console.error);
  }, []);

  const allStates = states
    ? [...states.active, ...states.done]
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
