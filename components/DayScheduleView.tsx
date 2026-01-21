import { StatePill } from "@/components/StatePill";
import { getTodoKey } from "@/components/TodoItem";
import { useTodoEditingContext } from "@/hooks/useTodoEditing";
import { Todo } from "@/services/api";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

interface DayScheduleViewProps {
  entries: (Todo & { completedAt?: string | null })[];
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}

type TimedEntry = {
  entry: Todo & { completedAt?: string | null };
  time: { hours: number; minutes: number };
  totalMinutes: number;
};

type PositionedEntry = TimedEntry & {
  column: number;
  totalColumns: number;
};

function getTimeFromEntry(
  entry: Todo,
): { hours: number; minutes: number } | null {
  // Check scheduled first, then deadline
  const timeStr = entry.scheduled || entry.deadline;
  if (!timeStr) return null;

  // Check if it has a time component (contains T and :)
  if (!timeStr.includes("T") || !timeStr.includes(":")) return null;

  const date = new Date(timeStr);
  if (isNaN(date.getTime())) return null;

  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${displayHour} ${period}`;
}

function formatTime(hours: number, minutes: number): string {
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const displayMinutes = minutes.toString().padStart(2, "0");
  return `${displayHour}:${displayMinutes} ${period}`;
}

// Compact todo item for schedule view
function CompactTodoItem({
  todo,
  opacity = 1,
}: {
  todo: Todo & { completedAt?: string | null };
  opacity?: number;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { handleTodoPress, completingIds } = useTodoEditingContext();

  const key = getTodoKey(todo);
  const isCompleting = completingIds.has(key);

  const handlePress = useCallback(() => {
    router.push({
      pathname: "/edit",
      params: {
        todo: JSON.stringify(todo),
      },
    });
  }, [router, todo]);

  const onTodoChipPress = useCallback(() => {
    handleTodoPress(todo);
  }, [handleTodoPress, todo]);

  const time = getTimeFromEntry(todo);

  return (
    <Pressable onPress={handlePress}>
      <View
        style={[
          styles.compactItem,
          {
            backgroundColor: theme.colors.surfaceVariant,
            borderLeftColor: theme.colors.primary,
            opacity,
          },
        ]}
      >
        {todo.todo && (
          <StatePill
            state={todo.todo}
            selected={false}
            onPress={onTodoChipPress}
            loading={isCompleting}
          />
        )}
        <Text
          style={[styles.compactTitle, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {todo.title}
        </Text>
        {time && (
          <Text style={[styles.compactTime, { color: theme.colors.primary }]}>
            {formatTime(time.hours, time.minutes)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function DayScheduleView({
  entries,
  startHour = 0,
  endHour = 24,
  hourHeight = 60,
  refreshing = false,
  onRefresh,
}: DayScheduleViewProps) {
  const theme = useTheme();

  // Separate entries by timed/untimed and active/completed
  const { positionedEntries, activeUntimedEntries, completedEntries } = useMemo(() => {
    const timedActive: TimedEntry[] = [];
    const timedCompleted: TimedEntry[] = [];
    const untimedActive: (Todo & { completedAt?: string | null })[] = [];
    const untimedCompleted: (Todo & { completedAt?: string | null })[] = [];

    entries.forEach((entry) => {
      const time = getTimeFromEntry(entry);
      if (time) {
        const totalMinutes = time.hours * 60 + time.minutes;
        if (entry.completedAt) {
          timedCompleted.push({ entry, time, totalMinutes });
        } else {
          timedActive.push({ entry, time, totalMinutes });
        }
      } else if (entry.completedAt) {
        untimedCompleted.push(entry);
      } else {
        untimedActive.push(entry);
      }
    });

    // Sort timed entries by time
    timedActive.sort((a, b) => a.totalMinutes - b.totalMinutes);
    timedCompleted.sort((a, b) => a.totalMinutes - b.totalMinutes);

    // Combine all completed entries: untimed first, then timed (sorted by time)
    const allCompleted: (Todo & { completedAt?: string | null })[] = [
      ...untimedCompleted,
      ...timedCompleted.map(t => t.entry),
    ];

    // Assign columns for overlapping items (only for active timed entries)
    // Items are considered overlapping if they're within 30 minutes of each other
    const OVERLAP_THRESHOLD = 30; // minutes
    const positioned: PositionedEntry[] = [];

    for (const item of timedActive) {
      // Find overlapping items already positioned
      const overlapping = positioned.filter(
        (p) => Math.abs(p.totalMinutes - item.totalMinutes) < OVERLAP_THRESHOLD,
      );

      if (overlapping.length === 0) {
        positioned.push({ ...item, column: 0, totalColumns: 1 });
      } else {
        // Find the first available column
        const usedColumns = new Set(overlapping.map((p) => p.column));
        let column = 0;
        while (usedColumns.has(column)) column++;

        const newTotalColumns = Math.max(
          column + 1,
          ...overlapping.map((p) => p.totalColumns),
        );

        // Update all overlapping items with new total columns
        overlapping.forEach((p) => {
          p.totalColumns = newTotalColumns;
        });

        positioned.push({ ...item, column, totalColumns: newTotalColumns });
      }
    }

    // Second pass: update totalColumns for all items in each overlap group
    for (let i = 0; i < positioned.length; i++) {
      const item = positioned[i];
      const overlapping = positioned.filter(
        (p) => Math.abs(p.totalMinutes - item.totalMinutes) < OVERLAP_THRESHOLD,
      );
      const maxColumns = Math.max(...overlapping.map((p) => p.totalColumns));
      overlapping.forEach((p) => {
        p.totalColumns = maxColumns;
      });
    }

    return { positionedEntries: positioned, activeUntimedEntries: untimedActive, completedEntries: allCompleted };
  }, [entries]);

  const totalHours = endHour - startHour;
  const totalHeight = totalHours * hourHeight;

  // Generate hour markers
  const hourMarkers = useMemo(() => {
    const markers = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      markers.push(hour);
    }
    return markers;
  }, [startHour, endHour]);

  // Calculate position for a time
  const getPositionForTime = (hours: number, minutes: number): number => {
    const totalMinutes = (hours - startHour) * 60 + minutes;
    const maxMinutes = totalHours * 60;
    return Math.max(
      0,
      Math.min(totalHeight, (totalMinutes / maxMinutes) * totalHeight),
    );
  };

  // Get current time indicator position
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const showCurrentTime = currentHour >= startHour && currentHour < endHour;
  const currentTimePosition = showCurrentTime
    ? getPositionForTime(currentHour, currentMinute)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {/* Untimed active entries section */}
      {activeUntimedEntries.length > 0 && (
        <View style={styles.untimedSection}>
          <View
            style={[
              styles.untimedHeader,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              All Day / No Time
            </Text>
          </View>
          {activeUntimedEntries.map((entry) => (
            <CompactTodoItem
              key={getTodoKey(entry)}
              todo={entry}
              opacity={1}
            />
          ))}
        </View>
      )}

      {/* Timeline section */}
      <View style={[styles.timeline, { height: totalHeight }]}>
        {/* Hour markers and grid lines */}
        {hourMarkers.map((hour) => {
          const position = getPositionForTime(hour, 0);
          const isMidnight = hour === 0 || hour === 24;
          return (
            <View key={hour} style={[styles.hourRow, { top: position }]}>
              <Text
                style={[
                  styles.hourLabel,
                  {
                    color: isMidnight
                      ? theme.colors.primary
                      : theme.colors.outline,
                    fontWeight: isMidnight ? "600" : "400",
                  },
                ]}
              >
                {formatHour(hour)}
              </Text>
              <View
                style={[
                  styles.hourLine,
                  {
                    backgroundColor: isMidnight
                      ? theme.colors.primary
                      : theme.colors.outlineVariant,
                    height: isMidnight ? 1 : StyleSheet.hairlineWidth,
                  },
                ]}
              />
            </View>
          );
        })}

        {/* Current time indicator */}
        {showCurrentTime && (
          <View style={[styles.currentTimeRow, { top: currentTimePosition }]}>
            <View
              style={[
                styles.currentTimeDot,
                { backgroundColor: theme.colors.error },
              ]}
            />
            <View
              style={[
                styles.currentTimeLine,
                { backgroundColor: theme.colors.error },
              ]}
            />
          </View>
        )}

        {/* Timed entries */}
        {positionedEntries.map(({ entry, time, column, totalColumns }) => {
          const position = getPositionForTime(time.hours, time.minutes);
          const widthPercent = 100 / totalColumns;
          const leftPercent = (column / totalColumns) * 100;

          return (
            <View
              key={getTodoKey(entry)}
              style={[
                styles.timedEntry,
                {
                  top: position,
                  width: `${widthPercent}%` as const,
                  left: `${leftPercent}%` as const,
                },
              ]}
            >
              <CompactTodoItem
                todo={entry}
                opacity={entry.completedAt ? 0.6 : 1}
              />
            </View>
          );
        })}
      </View>

      {/* Completed entries section - all done items grouped at the end */}
      {completedEntries.length > 0 && (
        <View style={styles.completedSection}>
          <View
            style={[
              styles.untimedHeader,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Completed
            </Text>
          </View>
          {completedEntries.map((entry) => (
            <CompactTodoItem
              key={getTodoKey(entry)}
              todo={entry}
              opacity={0.6}
            />
          ))}
        </View>
      )}

      {/* Empty state for timed section */}
      {positionedEntries.length === 0 && activeUntimedEntries.length === 0 && completedEntries.length === 0 && (
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
            No items for today
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  untimedSection: {
    marginBottom: 8,
  },
  completedSection: {
    marginTop: 8,
  },
  untimedHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timeline: {
    position: "relative",
    marginLeft: 60,
    marginRight: 8,
  },
  hourRow: {
    position: "absolute",
    left: -60,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    height: 0,
  },
  hourLabel: {
    width: 52,
    fontSize: 11,
    textAlign: "right",
    paddingRight: 8,
  },
  hourLine: {
    flex: 1,
  },
  currentTimeRow: {
    position: "absolute",
    left: -8,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    height: 0,
    zIndex: 10,
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: -4,
  },
  currentTimeLine: {
    flex: 1,
    height: 2,
  },
  timedEntry: {
    position: "absolute",
    paddingRight: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  compactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginVertical: 1,
    marginHorizontal: 2,
    borderRadius: 4,
    borderLeftWidth: 3,
  },
  compactTime: {
    fontSize: 10,
    fontWeight: "500",
    flexShrink: 0,
  },
  compactTitle: {
    fontSize: 12,
    flex: 1,
  },
});

export default DayScheduleView;
