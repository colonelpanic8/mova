import { useColorPalette } from "@/context/ColorPaletteContext";
import { getContrastColor } from "@/utils/color";
import React from "react";
import { StyleSheet } from "react-native";
import { Chip } from "react-native-paper";

interface StatePillProps {
  state: string;
  selected?: boolean;
  onPress?: () => void;
  loading?: boolean;
}

export function StatePill({
  state,
  selected = true,
  onPress,
  loading = false,
}: StatePillProps) {
  const { getTodoStateColor } = useColorPalette();

  const backgroundColor = getTodoStateColor(state);
  const textColor = getContrastColor(backgroundColor);

  return (
    <Chip
      mode="flat"
      compact
      onPress={loading ? undefined : onPress}
      style={[
        styles.chip,
        { backgroundColor },
        !selected && styles.unselected,
        loading && styles.loading,
      ]}
      textStyle={{ fontSize: 10, color: textColor }}
    >
      {loading ? "..." : state}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 24,
    justifyContent: "center",
  },
  unselected: {
    opacity: 0.5,
  },
  loading: {
    opacity: 0.6,
  },
});
