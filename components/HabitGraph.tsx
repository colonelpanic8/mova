import { useHabitConfig } from "@/context/HabitConfigContext";
import { MiniGraphEntry } from "@/services/api";
import { getHabitCellColor } from "@/utils/habitColors";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface HabitGraphProps {
  miniGraph: MiniGraphEntry[];
  expanded?: boolean;
}

interface GraphCellProps {
  entry: MiniGraphEntry;
  isToday: boolean;
  colors: { conforming: string; notConforming: string };
  glyphs: { completionNeededToday: string; completed: string };
}

function GraphCell({ entry, isToday, colors, glyphs }: GraphCellProps) {
  const theme = useTheme();
  const backgroundColor = getHabitCellColor(entry.conformingRatio, colors);

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
    <View
      style={[
        styles.cell,
        { backgroundColor },
        isToday && [styles.todayCell, { borderColor: theme.colors.primary }],
      ]}
    >
      {glyph ? (
        <Text style={styles.glyph} numberOfLines={1}>
          {glyph}
        </Text>
      ) : null}
    </View>
  );
}

export function HabitGraph({ miniGraph, expanded = false }: HabitGraphProps) {
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
  },
  expandedContainer: {
    flexWrap: "wrap",
  },
  cell: {
    width: 18,
    height: 18,
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
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 5,
  },
  glyph: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});

export default HabitGraph;
