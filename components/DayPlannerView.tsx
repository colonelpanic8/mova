import { StatePill } from "@/components/StatePill";
import { useTodoEditingContext } from "@/hooks/useTodoEditing";
import { Todo } from "@/services/api";
import { formatLocalDate } from "@/utils/dateFormatting";
import {
  buildScheduledTimestamp,
  getSnappedDropTime,
  getTimeFromEntry,
  ScheduleTime,
} from "@/utils/dayPlanning";
import { formatHour, formatTime } from "@/utils/timeFormatting";
import { getTodoKey } from "@/utils/todoKey";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

type PlannerEntry = Todo & { completedAt?: string | null };

interface DayPlannerViewProps {
  date: string;
  entries: PlannerEntry[];
  doneStates?: string[];
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}

interface TimedEntry {
  entry: PlannerEntry;
  time: ScheduleTime;
  totalMinutes: number;
  column: number;
  totalColumns: number;
}

interface MeasuredBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  entry: PlannerEntry;
  pageX: number;
  pageY: number;
}

function isHorizontalDrag(gesture: PanResponderGestureState): boolean {
  return (
    Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy)
  );
}

function positionTimedEntries(entries: PlannerEntry[]): TimedEntry[] {
  const positioned: TimedEntry[] = entries
    .map((entry) => {
      let time = getTimeFromEntry(entry);
      if (!time && entry.completedAt) {
        const completedDate = new Date(entry.completedAt);
        if (!Number.isNaN(completedDate.getTime())) {
          time = {
            hours: completedDate.getHours(),
            minutes: completedDate.getMinutes(),
          };
        }
      }
      if (!time) return null;
      return {
        entry,
        time,
        totalMinutes: time.hours * 60 + time.minutes,
        column: 0,
        totalColumns: 1,
      };
    })
    .filter((entry): entry is TimedEntry => entry !== null)
    .sort((a, b) => a.totalMinutes - b.totalMinutes);

  for (let index = 0; index < positioned.length; index++) {
    const item = positioned[index];
    const overlapping = positioned
      .slice(0, index)
      .filter((other) => Math.abs(other.totalMinutes - item.totalMinutes) < 30);
    const usedColumns = new Set(overlapping.map((other) => other.column));
    while (usedColumns.has(item.column)) item.column += 1;
    const totalColumns = Math.max(
      item.column + 1,
      ...overlapping.map((other) => other.totalColumns),
    );
    item.totalColumns = totalColumns;
    overlapping.forEach((other) => {
      other.totalColumns = totalColumns;
    });
  }

  return positioned;
}

function PlannerCard({
  todo,
  completed = false,
  dragging = false,
}: {
  todo: PlannerEntry;
  completed?: boolean;
  dragging?: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { completingIds, updatingIds, handleTodoPress } =
    useTodoEditingContext();
  const key = getTodoKey(todo);
  const isUpdating = updatingIds.has(key);

  const openTodo = useCallback(() => {
    router.push({ pathname: "/edit", params: { todo: JSON.stringify(todo) } });
  }, [router, todo]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderLeftColor: theme.colors.primary,
          opacity: completed || dragging ? 0.55 : 1,
        },
      ]}
    >
      {todo.todo ? (
        <StatePill
          state={todo.todo}
          selected={false}
          onPress={() => handleTodoPress(todo)}
          loading={completingIds.has(key)}
        />
      ) : null}
      <Pressable
        onPress={openTodo}
        accessibilityRole="button"
        accessibilityLabel={todo.title}
        style={styles.cardTitleButton}
      >
        <Text style={styles.cardTitle} numberOfLines={2}>
          {todo.title}
        </Text>
      </Pressable>
      {isUpdating ? <ActivityIndicator size={14} /> : null}
    </View>
  );
}

function DraggablePlannerCard({
  todo,
  dragging,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  todo: PlannerEntry;
  dragging: boolean;
  onDragStart: (todo: PlannerEntry, pageX: number, pageY: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (pageX: number, pageY: number) => void;
}) {
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => isHorizontalDrag(gesture),
        onMoveShouldSetPanResponderCapture: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => isHorizontalDrag(gesture),
        onPanResponderGrant: (event) => {
          onDragStart(todo, event.nativeEvent.pageX, event.nativeEvent.pageY);
        },
        onPanResponderMove: (event) => {
          onDragMove(event.nativeEvent.pageX, event.nativeEvent.pageY);
        },
        onPanResponderRelease: (event) => {
          onDragEnd(event.nativeEvent.pageX, event.nativeEvent.pageY);
        },
        onPanResponderTerminate: (event) => {
          onDragEnd(event.nativeEvent.pageX, event.nativeEvent.pageY);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [onDragEnd, onDragMove, onDragStart, todo],
  );

  return (
    <View
      {...responder.panHandlers}
      testID={`plannerQueueItem-${getTodoKey(todo)}`}
      accessibilityHint="Drag left onto a time slot to schedule"
    >
      <PlannerCard todo={todo} dragging={dragging} />
    </View>
  );
}

export function DayPlannerView({
  date,
  entries,
  doneStates = [],
  startHour = 0,
  endHour = 24,
  hourHeight = 60,
  refreshing = false,
  onRefresh,
}: DayPlannerViewProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { scheduleTodo } = useTodoEditingContext();
  const rootRef = useRef<View>(null);
  const timelineRef = useRef<View>(null);
  const timelineScrollRef = useRef<ScrollView>(null);
  const rootBox = useRef<MeasuredBox | null>(null);
  const timelineBox = useRef<MeasuredBox | null>(null);
  const scrollOffset = useRef(0);
  const dragEntryRef = useRef<PlannerEntry | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropPreview, setDropPreview] = useState<ScheduleTime | null>(null);

  const isCompleted = useCallback(
    (entry: PlannerEntry) =>
      Boolean(entry.completedAt || doneStates.includes(entry.todo)),
    [doneStates],
  );

  const { positionedEntries, untimedEntries } = useMemo(() => {
    const untimed = entries.filter(
      (entry) =>
        entry.scheduled?.date === date &&
        !entry.scheduled.time &&
        !getTimeFromEntry(entry) &&
        !isCompleted(entry),
    );
    return {
      positionedEntries: positionTimedEntries(entries),
      untimedEntries: untimed,
    };
  }, [date, entries, isCompleted]);

  const totalHeight = (endHour - startHour) * hourHeight;
  const queueWidth = Math.max(148, Math.min(320, width * 0.36));
  const hourMarkers = useMemo(
    () =>
      Array.from(
        { length: endHour - startHour + 1 },
        (_, index) => startHour + index,
      ),
    [endHour, startHour],
  );

  const positionForTime = useCallback(
    (time: ScheduleTime) =>
      ((time.hours - startHour) * 60 + time.minutes) * (hourHeight / 60),
    [hourHeight, startHour],
  );

  useEffect(() => {
    const now = new Date();
    const suggestedHour =
      date === formatLocalDate(now)
        ? Math.max(startHour, now.getHours() - 1)
        : Math.max(startHour, 7);
    const openingHour = Math.min(endHour - 1, suggestedHour);
    const y = Math.max(0, (openingHour - startHour) * hourHeight);
    timelineScrollRef.current?.scrollTo({ y, animated: false });
    scrollOffset.current = y;
  }, [date, endHour, hourHeight, startHour]);

  const measureRoot = useCallback(() => {
    rootRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      rootBox.current = { x, y, width: measuredWidth, height: measuredHeight };
    });
  }, []);

  const measureTimeline = useCallback(() => {
    timelineRef.current?.measureInWindow(
      (x, y, measuredWidth, measuredHeight) => {
        timelineBox.current = {
          x,
          y,
          width: measuredWidth,
          height: measuredHeight,
        };
      },
    );
  }, []);

  const previewForPoint = useCallback(
    (pageX: number, pageY: number) => {
      const box = timelineBox.current;
      if (!box || pageX < box.x || pageX > box.x + box.width) return null;
      return getSnappedDropTime({
        dropY: pageY,
        viewportTop: box.y,
        viewportHeight: box.height,
        scrollOffset: scrollOffset.current,
        startHour,
        endHour,
        hourHeight,
      });
    },
    [endHour, hourHeight, startHour],
  );

  const handleDragStart = useCallback(
    (entry: PlannerEntry, pageX: number, pageY: number) => {
      measureRoot();
      measureTimeline();
      dragEntryRef.current = entry;
      setDrag({ entry, pageX, pageY });
      setDropPreview(previewForPoint(pageX, pageY));
    },
    [measureRoot, measureTimeline, previewForPoint],
  );

  const handleDragMove = useCallback(
    (pageX: number, pageY: number) => {
      setDrag((current) => (current ? { ...current, pageX, pageY } : current));
      setDropPreview(previewForPoint(pageX, pageY));
    },
    [previewForPoint],
  );

  const handleDragEnd = useCallback(
    (pageX: number, pageY: number) => {
      const time = previewForPoint(pageX, pageY);
      const entry = dragEntryRef.current;
      if (entry && time) {
        void scheduleTodo(entry, buildScheduledTimestamp(entry, date, time));
      }
      dragEntryRef.current = null;
      setDrag(null);
      setDropPreview(null);
    },
    [date, previewForPoint, scheduleTodo],
  );

  const now = new Date();
  const showCurrentTime =
    date === formatLocalDate(now) &&
    now.getHours() >= startHour &&
    now.getHours() < endHour;
  const currentTime = { hours: now.getHours(), minutes: now.getMinutes() };
  const origin = rootBox.current ?? { x: 0, y: 0, width: 0, height: 0 };

  return (
    <View
      ref={rootRef}
      testID="dayPlannerView"
      style={styles.container}
      onLayout={measureRoot}
    >
      <View style={styles.columns}>
        <View
          ref={timelineRef}
          testID="plannerTimeline"
          style={styles.timelineViewport}
          onLayout={measureTimeline}
        >
          <ScrollView
            ref={timelineScrollRef}
            style={styles.timelineScroll}
            onScroll={(event) => {
              scrollOffset.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              ) : undefined
            }
          >
            <View style={[styles.timeline, { height: totalHeight }]}>
              {hourMarkers.map((hour) => {
                const top = (hour - startHour) * hourHeight;
                const isMidnight = hour === 0 || hour === 24;
                return (
                  <View key={hour} style={[styles.hourRow, { top }]}>
                    <Text
                      style={[
                        styles.hourLabel,
                        {
                          color: isMidnight
                            ? theme.colors.primary
                            : theme.colors.outline,
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
                        },
                      ]}
                    />
                  </View>
                );
              })}

              {showCurrentTime ? (
                <View
                  style={[
                    styles.currentTimeRow,
                    { top: positionForTime(currentTime) },
                  ]}
                >
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
              ) : null}

              {dropPreview ? (
                <View
                  testID="plannerDropPreview"
                  style={[
                    styles.dropPreview,
                    {
                      top: positionForTime(dropPreview),
                      borderColor: theme.colors.primary,
                      backgroundColor: theme.colors.primaryContainer,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dropPreviewLabel,
                      { color: theme.colors.onPrimaryContainer },
                    ]}
                  >
                    {formatTime(dropPreview.hours, dropPreview.minutes)}
                  </Text>
                </View>
              ) : null}

              {positionedEntries.map(
                ({ entry, time, column, totalColumns }) => (
                  <View
                    key={getTodoKey(entry)}
                    style={[
                      styles.timedEntry,
                      {
                        top: positionForTime(time),
                        left: `${(column / totalColumns) * 100}%`,
                        width: `${100 / totalColumns}%`,
                      },
                    ]}
                  >
                    <PlannerCard todo={entry} completed={isCompleted(entry)} />
                  </View>
                ),
              )}
            </View>
          </ScrollView>
        </View>

        <View
          testID="plannerQueue"
          style={[
            styles.queue,
            {
              width: queueWidth,
              borderLeftColor: theme.colors.outlineVariant,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <View
            style={[
              styles.queueHeader,
              { borderBottomColor: theme.colors.outlineVariant },
            ]}
          >
            <Text variant="titleSmall">No time</Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Drag onto the timeline
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.queueContent}
            scrollEnabled={!drag}
          >
            {untimedEntries.length === 0 ? (
              <Text
                testID="plannerQueueEmpty"
                variant="bodyMedium"
                style={[
                  styles.queueEmpty,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Everything has a time
              </Text>
            ) : (
              untimedEntries.map((entry) => (
                <DraggablePlannerCard
                  key={getTodoKey(entry)}
                  todo={entry}
                  dragging={
                    drag != null && getTodoKey(drag.entry) === getTodoKey(entry)
                  }
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>

      {drag ? (
        <View
          pointerEvents="none"
          testID="plannerDragGhost"
          style={[
            styles.dragGhost,
            {
              left: drag.pageX - origin.x - queueWidth / 2,
              top: drag.pageY - origin.y - 24,
              width: queueWidth - 16,
              backgroundColor: theme.colors.elevation.level3,
              borderColor: theme.colors.primary,
            },
          ]}
        >
          <Text numberOfLines={1}>{drag.entry.title}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  columns: {
    flex: 1,
    flexDirection: "row",
  },
  timelineViewport: {
    flex: 1,
  },
  timelineScroll: {
    flex: 1,
  },
  timeline: {
    position: "relative",
    marginLeft: 58,
    marginRight: 8,
  },
  hourRow: {
    position: "absolute",
    left: -58,
    right: 0,
    height: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  hourLabel: {
    width: 50,
    paddingRight: 8,
    textAlign: "right",
    fontSize: 11,
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  currentTimeRow: {
    position: "absolute",
    left: -8,
    right: 0,
    height: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 4,
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
  card: {
    minHeight: 36,
    marginVertical: 2,
    marginHorizontal: 2,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderLeftWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardTitle: {
    fontSize: 12,
  },
  cardTitleButton: {
    flex: 1,
  },
  queue: {
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  queueHeader: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  queueContent: {
    padding: 6,
  },
  queueEmpty: {
    paddingHorizontal: 8,
    paddingVertical: 20,
    textAlign: "center",
  },
  dropPreview: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 30,
    marginTop: -15,
    borderWidth: 1,
    borderRadius: 5,
    justifyContent: "center",
    zIndex: 3,
  },
  dropPreviewLabel: {
    paddingHorizontal: 6,
    fontSize: 11,
    fontWeight: "600",
  },
  dragGhost: {
    position: "absolute",
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 7,
    justifyContent: "center",
    zIndex: 20,
    elevation: 8,
  },
});

export default DayPlannerView;
