import { useHabitConfig } from "@/context/HabitConfigContext";
import { MiniGraphEntry } from "@/services/api";
import { getHabitCellColor } from "@/utils/habitColors";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

interface HabitGraphProps {
  miniGraph: MiniGraphEntry[];
  expanded?: boolean;
}

interface GraphCellProps {
  entry: MiniGraphEntry;
  isToday: boolean;
  colors: { conforming: string; notConforming: string };
  glyphs: { completionNeededToday: string; completed: string };
  borderColor: string;
  textColor: string;
}

function GraphCell({ entry, isToday, colors, glyphs, borderColor, textColor }: GraphCellProps) {
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
        isToday && [styles.todayCell, { borderColor }],
      ]}
    >
      {glyph ? (
        <Text style={[styles.glyph, { color: textColor }]}>{glyph}</Text>
      ) : null}
    </View>
  );
}

export function HabitGraph({ miniGraph, expanded = false }: HabitGraphProps) {
  const { colors, glyphs } = useHabitConfig();
  const theme = useTheme();

  if (!miniGraph || miniGraph.length === 0) {
    return null;
  }

  // Find today's index (last entry with completionNeededToday defined, or second-to-last).
  // The fallback to miniGraph.length - 2 assumes the graph includes tomorrow's entry as
  // the last element, making today the second-to-last position.
  const todayIndex = miniGraph.findIndex((e) => e.completionNeededToday !== undefined);
  const effectiveTodayIndex = todayIndex >= 0 ? todayIndex : miniGraph.length - 2;

  return (
    <View style={[styles.container, expanded && styles.expandedContainer]} testID="habit-graph">
      {miniGraph.map((entry, index) => (
        <GraphCell
          key={entry.date}
          entry={entry}
          isToday={index === effectiveTodayIndex}
          colors={colors}
          glyphs={glyphs}
          borderColor={theme.colors.outline}
          textColor={theme.colors.onSurface}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  expandedContainer: {
    // For expanded mode - will be scrollable
  },
  cell: {
    width: 12,
    height: 16,
    marginHorizontal: 1,
    borderRadius: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  todayCell: {
    width: 16,
    borderWidth: 1,
  },
  glyph: {
    fontSize: 10,
  },
});

export default HabitGraph;
