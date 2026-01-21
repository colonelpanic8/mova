import { TodoItem, getTodoKey } from "@/components/TodoItem";
import { Todo } from "@/services/api";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface DayScheduleViewProps {
  entries: (Todo & { completedAt?: string | null })[];
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
}

function getTimeFromEntry(entry: Todo): { hours: number; minutes: number } | null {
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
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour} ${period}`;
}

export function DayScheduleView({
  entries,
  startHour = 6,
  endHour = 22,
  hourHeight = 60,
}: DayScheduleViewProps) {
  const theme = useTheme();

  // Separate entries with times from those without
  const { timedEntries, untimedEntries } = useMemo(() => {
    const timed: { entry: Todo & { completedAt?: string | null }; time: { hours: number; minutes: number } }[] = [];
    const untimed: (Todo & { completedAt?: string | null })[] = [];

    entries.forEach((entry) => {
      const time = getTimeFromEntry(entry);
      if (time) {
        timed.push({ entry, time });
      } else {
        untimed.push(entry);
      }
    });

    // Sort timed entries by time
    timed.sort((a, b) => {
      const aMinutes = a.time.hours * 60 + a.time.minutes;
      const bMinutes = b.time.hours * 60 + b.time.minutes;
      return aMinutes - bMinutes;
    });

    return { timedEntries: timed, untimedEntries: untimed };
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
    return Math.max(0, Math.min(totalHeight, (totalMinutes / maxMinutes) * totalHeight));
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
    <ScrollView style={styles.container}>
      {/* Untimed entries section */}
      {untimedEntries.length > 0 && (
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
          {untimedEntries.map((entry) => (
            <TodoItem
              key={getTodoKey(entry)}
              todo={entry}
              opacity={entry.completedAt ? 0.6 : 1}
            />
          ))}
        </View>
      )}

      {/* Timeline section */}
      <View style={[styles.timeline, { height: totalHeight }]}>
        {/* Hour markers and grid lines */}
        {hourMarkers.map((hour) => {
          const position = getPositionForTime(hour, 0);
          return (
            <View key={hour} style={[styles.hourRow, { top: position }]}>
              <Text
                style={[styles.hourLabel, { color: theme.colors.outline }]}
              >
                {formatHour(hour)}
              </Text>
              <View
                style={[
                  styles.hourLine,
                  { backgroundColor: theme.colors.outlineVariant },
                ]}
              />
            </View>
          );
        })}

        {/* Current time indicator */}
        {showCurrentTime && (
          <View style={[styles.currentTimeRow, { top: currentTimePosition }]}>
            <View
              style={[styles.currentTimeDot, { backgroundColor: theme.colors.error }]}
            />
            <View
              style={[styles.currentTimeLine, { backgroundColor: theme.colors.error }]}
            />
          </View>
        )}

        {/* Timed entries */}
        {timedEntries.map(({ entry, time }) => {
          const position = getPositionForTime(time.hours, time.minutes);
          return (
            <View
              key={getTodoKey(entry)}
              style={[styles.timedEntry, { top: position }]}
            >
              <TodoItem
                todo={entry}
                opacity={entry.completedAt ? 0.6 : 1}
              />
            </View>
          );
        })}
      </View>

      {/* Empty state for timed section */}
      {timedEntries.length === 0 && untimedEntries.length === 0 && (
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
    height: StyleSheet.hairlineWidth,
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
    left: 0,
    right: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
});

export default DayScheduleView;
