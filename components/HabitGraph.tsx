import { useHabitConfig } from "@/context/HabitConfigContext";
import { MiniGraphEntry, WindowSpecStatus } from "@/services/api";
import { getHabitCellColor } from "@/utils/habitColors";
import React, { useCallback, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

interface HabitGraphProps {
  miniGraph: MiniGraphEntry[];
  expanded?: boolean;
  onCellPress?: (entry: MiniGraphEntry) => void;
  nextRequiredDate?: string;
  windowSpecsStatus?: WindowSpecStatus[];
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
  onLayout?: (event: LayoutChangeEvent) => void;
  cellWidth: number;
  cellLabel: string;
}

// Convert a duration record to days
function durationToDays(duration: Record<string, number>): number {
  let days = 0;
  if (duration.days) days += duration.days;
  if (duration.weeks) days += duration.weeks * 7;
  if (duration.months) days += duration.months * 30;
  if (duration.years) days += duration.years * 365;
  return days;
}

// Format duration for display
function formatDuration(duration: Record<string, number>): string {
  const parts: string[] = [];
  if (duration.years) {
    parts.push(duration.years === 1 ? "year" : `${duration.years}y`);
  }
  if (duration.months) {
    parts.push(duration.months === 1 ? "month" : `${duration.months}mo`);
  }
  if (duration.weeks) {
    parts.push(duration.weeks === 1 ? "week" : `${duration.weeks}w`);
  }
  if (duration.days) {
    parts.push(duration.days === 1 ? "day" : `${duration.days}d`);
  }
  return parts.join(" ") || "?";
}

// Parse a date string that might or might not have a time portion
function parseDate(dateStr: string): Date {
  // If it already has a T (time portion), use as-is
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  // Otherwise add midnight time to ensure correct local date
  return new Date(dateStr + "T00:00:00");
}

// Calculate interval duration in days from assessment period
function getIntervalDays(entry: MiniGraphEntry): number {
  if (!entry.assessmentStart || !entry.assessmentEnd) return 1;
  const start = parseDate(entry.assessmentStart);
  const end = parseDate(entry.assessmentEnd);
  // Handle invalid dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  const days = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(1, days);
}

// Base cell width
const BASE_CELL_WIDTH = 24;

// Calculate cell width based on interval duration
function getCellWidth(intervalDays: number, isToday: boolean): number {
  let width: number;
  if (intervalDays <= 14) {
    // For intervals up to 2 weeks, scale proportionally
    width = BASE_CELL_WIDTH * intervalDays;
  } else if (intervalDays <= 31) {
    // Monthly intervals: 2.5x base width
    width = BASE_CELL_WIDTH * 2.5;
  } else {
    // Longer intervals: 3x base width
    width = BASE_CELL_WIDTH * 3;
  }
  // Add extra width for today cell
  if (isToday) {
    width += 4;
  }
  return width;
}

// Month abbreviations
const MONTH_ABBREVS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Format cell label based on interval type
function getCellLabel(entry: MiniGraphEntry, intervalDays: number): string {
  // Handle missing entry or date
  if (!entry?.date) {
    return "?";
  }

  const startDateStr = entry.assessmentStart || entry.date;
  const startDate = parseDate(startDateStr);

  // Check for invalid date
  if (isNaN(startDate.getTime())) {
    return "?";
  }

  if (intervalDays === 1) {
    // Daily: just show day number
    return String(startDate.getDate());
  } else if (intervalDays <= 14) {
    // Up to 2 weeks: show day range "16-22"
    const endDateStr = entry.assessmentEnd || startDateStr;
    const endDate = parseDate(endDateStr);
    // assessmentEnd is exclusive, so subtract 1 day for display
    const displayEnd = new Date(endDate);
    displayEnd.setDate(displayEnd.getDate() - 1);
    const startDay = startDate.getDate();
    const endDay = displayEnd.getDate();
    if (startDay === endDay) {
      return String(startDay);
    }
    return `${startDay}-${endDay}`;
  } else {
    // Monthly or longer: show month abbreviation
    return MONTH_ABBREVS[startDate.getMonth()];
  }
}

interface CellLayout {
  x: number;
  width: number;
}

function GraphCell({
  entry,
  isToday,
  isNextRequired,
  isFuture,
  colors,
  glyphs,
  onPress,
  onLayout,
  cellWidth,
  cellLabel,
}: GraphCellProps) {
  const theme = useTheme();
  // conformingRatio of -1 indicates "no data" (habit didn't exist yet)
  const isNoData = entry.conformingRatio === -1;
  const backgroundColor = isNoData
    ? "rgba(150, 150, 150, 0.3)"
    : getHabitCellColor(entry.conformingRatio, colors);

  // Don't show glyphs for "no data" cells
  let glyph = "";
  if (!isNoData) {
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
  }

  // Calculate font size based on label length and cell width
  const labelLen = cellLabel?.length ?? 0;
  const labelFontSize = labelLen > 3 ? 9 : labelLen > 2 ? 10 : 11;

  return (
    <Pressable
      onPress={isNoData ? undefined : onPress}
      onLayout={onLayout}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor, width: cellWidth, height: 24 },
        isToday && [styles.todayCell, { borderColor: theme.colors.primary }],
        isFuture && styles.futureCell,
        isNoData && styles.noDataCell,
        pressed && !isNoData && styles.cellPressed,
      ]}
    >
      <Text
        style={[
          styles.dayNumber,
          { fontSize: labelFontSize },
          isNoData && styles.noDataDayNumber,
        ]}
        numberOfLines={1}
      >
        {cellLabel ?? "?"}
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
  windowSpecsStatus,
}: HabitGraphProps) {
  const { colors, glyphs } = useHabitConfig();
  const [cellLayouts, setCellLayouts] = useState<Map<number, CellLayout>>(
    new Map(),
  );

  const handleCellLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      setCellLayouts((prev) => {
        const next = new Map(prev);
        next.set(index, { x, width });
        return next;
      });
    },
    [],
  );

  if (!miniGraph || miniGraph.length === 0) {
    return null;
  }

  // Find today's index (entry with completionNeededToday defined)
  const todayIndex = miniGraph.findIndex(
    (e) => e.completionNeededToday !== undefined,
  );
  const effectiveTodayIndex =
    todayIndex >= 0 ? todayIndex : miniGraph.length - 1;

  // Parse dates for window calculations
  const parsedDates = miniGraph.map((e) => new Date(e.date + "T00:00:00"));

  // Calculate window bars based on actual cell layouts and windowSpecsStatus
  const windowBars =
    windowSpecsStatus && cellLayouts.size === miniGraph.length
      ? [...windowSpecsStatus]
          .sort(
            (a, b) => durationToDays(a.duration) - durationToDays(b.duration),
          )
          .map((specStatus) => {
            // Use backend-provided window boundaries instead of recalculating
            const windowStart = new Date(specStatus.windowStart);
            const windowEnd = new Date(specStatus.windowEnd);

            let startCellIndex = -1;
            let endCellIndex = -1;

            for (let i = 0; i < parsedDates.length; i++) {
              const cellDate = parsedDates[i];
              // windowEnd is exclusive (assessment-end = midnight of next day)
              // so use < instead of <= to exclude the next day's cell
              if (cellDate >= windowStart && cellDate < windowEnd) {
                if (startCellIndex === -1) startCellIndex = i;
                endCellIndex = i;
              }
            }

            if (startCellIndex === -1) return null;

            const startLayout = cellLayouts.get(startCellIndex);
            const endLayout = cellLayouts.get(endCellIndex);
            if (!startLayout || !endLayout) return null;

            const left = startLayout.x;
            const right = endLayout.x + endLayout.width;
            const width = right - left;

            return { specStatus, left, width, startCellIndex, endCellIndex };
          })
          .filter(Boolean)
      : [];

  const renderCell = (entry: MiniGraphEntry, index: number) => {
    const isToday = index === effectiveTodayIndex;
    const isFuture = index > effectiveTodayIndex;
    const intervalDays = getIntervalDays(entry);
    const cellWidth = getCellWidth(intervalDays, isToday);
    const cellLabel = getCellLabel(entry, intervalDays);

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
        onLayout={(e) => handleCellLayout(index, e)}
        cellWidth={cellWidth}
        cellLabel={cellLabel}
      />
    );
  };

  // Calculate the total width of the cells row for proper centering
  const rowWidth =
    cellLayouts.size === miniGraph.length
      ? (() => {
          const lastLayout = cellLayouts.get(miniGraph.length - 1);
          return lastLayout ? lastLayout.x + lastLayout.width : 0;
        })()
      : 0;

  return (
    <View style={styles.outerContainer} testID="habit-graph">
      <View style={[styles.row, expanded && styles.expandedContainer]}>
        {miniGraph.map((entry, index) => renderCell(entry, index))}
      </View>
      {windowBars.length > 0 && rowWidth > 0 && (
        <View style={[styles.windowBarsContainer, { width: rowWidth }]}>
          {windowBars.map((bar, index) => {
            const { specStatus } = bar!;
            const barColor = getHabitCellColor(
              specStatus.conformingRatio,
              colors,
            );
            const isConforming =
              specStatus.conformingRatio >= specStatus.conformingValue;

            return (
              <View key={index} style={styles.windowBarRow}>
                <View
                  style={[
                    styles.windowBar,
                    {
                      left: bar!.left,
                      width: bar!.width,
                      backgroundColor: barColor,
                      borderColor: barColor,
                    },
                  ]}
                >
                  <Text style={styles.windowBarText} numberOfLines={1}>
                    <Text
                      style={{
                        color: isConforming ? "#FFFFFF" : "#FFCCCC",
                        fontWeight: "700",
                      }}
                    >
                      {specStatus.completionsInWindow}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.6)" }}>/</Text>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                      {specStatus.targetRepetitions}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.6)" }}>
                      {" "}
                      for{" "}
                    </Text>
                    <Text
                      style={{
                        color: isConforming ? "#FFFFFF" : "#FFCCCC",
                        fontWeight: "700",
                      }}
                    >
                      {(specStatus.conformingRatio * 100).toFixed(1)}%
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.6)" }}> in </Text>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                      {formatDuration(specStatus.duration)}
                    </Text>
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: "rgba(155, 77, 184, 0.15)", // Mova purple with transparency
    padding: 6,
    borderRadius: 8,
    alignItems: "flex-end", // Right-align so "today" appears consistently
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  expandedContainer: {
    flexWrap: "wrap",
  },
  cell: {
    // width is set dynamically based on interval
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
    // width is set dynamically, just add border
    height: 28,
    borderWidth: 2,
    borderRadius: 5,
  },
  futureCell: {
    opacity: 0.4,
  },
  noDataCell: {
    opacity: 0.5,
  },
  noDataDayNumber: {
    color: "rgba(255, 255, 255, 0.6)",
  },
  cellPressed: {
    opacity: 0.6,
  },
  dayNumber: {
    // fontSize is set dynamically based on label length
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
  windowBarsContainer: {
    marginTop: 6,
    gap: 4,
  },
  windowBarRow: {
    height: 18,
    position: "relative",
  },
  windowBar: {
    position: "absolute",
    height: 18,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  windowBarText: {
    fontSize: 10,
    fontWeight: "500",
  },
});

export default HabitGraph;
