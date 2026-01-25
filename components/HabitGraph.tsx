import { useHabitConfig } from "@/context/HabitConfigContext";
import { MiniGraphEntry } from "@/services/api";
import { getHabitCellColor } from "@/utils/habitColors";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface HabitGraphProps {
  miniGraph: MiniGraphEntry[];
  expanded?: boolean;
  onCellPress?: (entry: MiniGraphEntry) => void;
}

interface GraphCellProps {
  entry: MiniGraphEntry;
  isToday: boolean;
  colors: { conforming: string; notConforming: string };
  glyphs: { completionNeededToday: string; completed: string };
  onPress?: () => void;
}

function GraphCell({
  entry,
  isToday,
  colors,
  glyphs,
  onPress,
}: GraphCellProps) {
  const theme = useTheme();
  const backgroundColor = getHabitCellColor(entry.conformingRatio, colors);

  // Extract day number from date string (YYYY-MM-DD)
  const dayNumber = parseInt(entry.date.split("-")[2], 10);

  let glyph = "";
  if (isToday || entry.completionNeededToday) {
    if (entry.completed) {
      glyph = glyphs.completed;
    } else if (entry.completionNeededToday) {
      glyph = glyphs.completionNeededToday;
    }
  } else if (entry.completed) {
    glyph = glyphs.completed;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor },
        isToday && [styles.todayCell, { borderColor: theme.colors.primary }],
        pressed && styles.cellPressed,
      ]}
    >
      <Text style={styles.dayNumber} numberOfLines={1}>
        {dayNumber}
      </Text>
      {glyph ? (
        <Text style={styles.glyph} numberOfLines={1}>
          {glyph}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function HabitGraph({
  miniGraph,
  expanded = false,
  onCellPress,
}: HabitGraphProps) {
  const { colors, glyphs } = useHabitConfig();

  if (!miniGraph || miniGraph.length === 0) {
    return null;
  }

  // Find today's index (last entry with completionNeededToday defined, or second-to-last).
  const todayIndex = miniGraph.findIndex(
    (e) => e.completionNeededToday !== undefined,
  );
  const effectiveTodayIndex =
    todayIndex >= 0 ? todayIndex : miniGraph.length - 2;

  return (
    <View
      style={[styles.container, expanded && styles.expandedContainer]}
      testID="habit-graph"
    >
      {miniGraph.map((entry, index) => (
        <GraphCell
          key={entry.date}
          entry={entry}
          isToday={index === effectiveTodayIndex}
          colors={colors}
          glyphs={glyphs}
          onPress={onCellPress ? () => onCellPress(entry) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(155, 77, 184, 0.15)", // Mova purple with transparency
    padding: 6,
    borderRadius: 8,
  },
  expandedContainer: {
    flexWrap: "wrap",
  },
  cell: {
    width: 24,
    height: 24,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  todayCell: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderRadius: 5,
  },
  cellPressed: {
    opacity: 0.6,
  },
  dayNumber: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  glyph: {
    position: "absolute",
    bottom: -2,
    right: -2,
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});

export default HabitGraph;
