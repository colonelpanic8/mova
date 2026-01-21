// components/capture/StatePicker.tsx
import { StatePill } from "@/components/StatePill";
import { useTemplates } from "@/context/TemplatesContext";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";

interface StatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function StatePicker({ value, onChange }: StatePickerProps) {
  const theme = useTheme();
  const { todoStates } = useTemplates();

  const activeStates = todoStates?.active || ["TODO", "NEXT", "WAITING"];
  const doneStates = todoStates?.done || ["DONE"];

  const renderChip = (state: string) => (
    <StatePill
      key={state}
      state={state}
      selected={value === state}
      onPress={() => onChange(state)}
    />
  );

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
  divider: {
    marginVertical: 12,
  },
});
