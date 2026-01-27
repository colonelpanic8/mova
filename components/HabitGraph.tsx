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
  nextRequiredDate?: string;
}

interface GraphCellProps {
  entry: MiniGraphEntry;
  isToday: boolean;
  isNextRequired: boolean;
  isFuture: boolean;
  colors: { conforming: string; notConforming: string };
  glyphs: {
    completionNeededToday: string;
    completed: string;
    nextRequired: string;
  };
  onPress?: () => void;
}

function GraphCell({
  entry,
  isToday,
  isNextRequired,
  isFuture,
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
  } else if (isNextRequired && (isToday || isFuture)) {
    // Only show next required icon on today or future dates, not past
    glyph = glyphs.nextRequired;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor },
        isToday && [styles.todayCell, { borderColor: theme.colors.primary }],
        isFuture && styles.futureCell,
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
  nextRequiredDate,
}: HabitGraphProps) {
  const { colors, glyphs } = useHabitConfig();

  if (!miniGraph || miniGraph.length === 0) {
    return null;
  }

  // Find today's index (entry with completionNeededToday defined)
  const todayIndex = miniGraph.findIndex(
    (e) => e.completionNeededToday !== undefined,
  );
  const effectiveTodayIndex =
    todayIndex >= 0 ? todayIndex : miniGraph.length - 1;

  const renderCell = (entry: MiniGraphEntry, index: number) => {
    const isToday = index === effectiveTodayIndex;
    const isFuture = index > effectiveTodayIndex;

    return (
      <GraphCell
        key={entry.date}
        entry={entry}
        isToday={isToday}
        isNextRequired={entry.date === nextRequiredDate}
        isFuture={isFuture}
        colors={colors}
        glyphs={glyphs}
        onPress={onCellPress ? () => onCellPress(entry) : undefined}
      />
    );
  };

  return (
    <View style={styles.outerContainer} testID="habit-graph">
      <View style={[styles.row, expanded && styles.expandedContainer]}>
        {miniGraph.map((entry, index) => renderCell(entry, index))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: "rgba(155, 77, 184, 0.15)", // Mova purple with transparency
    padding: 6,
    borderRadius: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
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
  futureCell: {
    opacity: 0.4,
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
