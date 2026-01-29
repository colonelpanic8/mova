import { DayScheduleView } from "@/components/DayScheduleView";
import { FilterBar } from "@/components/FilterBar";
import { HabitItem } from "@/components/HabitItem";
import { TodoItem, getTodoKey } from "@/components/TodoItem";
import { useApi } from "@/context/ApiContext";
import { useFilters } from "@/context/FilterContext";
import { useMutation } from "@/context/MutationContext";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import {
  AgendaEntry,
  HabitStatus,
  MiniGraphEntry,
  MultiDayAgendaResponse,
  SingleDayAgendaResponse,
  Todo,
  TodoStatesResponse,
} from "@/services/api";
import {
  formatLocalDate as formatDateForApi,
  formatDateForDisplay,
  isPastDay,
} from "@/utils/dateFormatting";
import { filterTodos } from "@/utils/filterTodos";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ActivityIndicator,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

/**
 * Get the start of the week (Sunday) for a given date.
 */
function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  result.setDate(result.getDate() - dayOfWeek);
  return result;
}

/**
 * Format a week date range for display.
 */
function formatWeekRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const startStr = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endStr = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${startStr} - ${endStr}`;
}

/**
 * Format a date for week view section headers.
 */
function formatWeekDayHeader(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface WeekDaySection {
  key: string;
  title: string;
  dateString: string;
  isToday: boolean;
  data: AgendaEntry[];
}

/**
 * Sort entries for list view: habits without a scheduled time go to the bottom,
 * grouped together. Regular tasks and habits with scheduled times stay at the top
 * in their original order.
 */
function sortEntriesForListView(entries: Todo[]): Todo[] {
  const regularItems: Todo[] = [];
  const habitsWithoutTime: Todo[] = [];

  for (const entry of entries) {
    const isHabit = entry.isWindowHabit || entry.properties?.STYLE === "habit";
    const hasScheduledTime = entry.scheduled?.time != null;

    if (isHabit && !hasScheduledTime) {
      habitsWithoutTime.push(entry);
    } else {
      regularItems.push(entry);
    }
  }

  return [...regularItems, ...habitsWithoutTime];
}

export default function AgendaScreen() {
  const [agenda, setAgenda] = useState<SingleDayAgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);
  const [showCompleted, setShowCompleted] = useState<boolean>(() =>
    isPastDay(new Date()),
  );
  const [viewMode, setViewMode] = useState<"list" | "schedule" | "week">(
    "list",
  );
  const [weekData, setWeekData] = useState<MultiDayAgendaResponse | null>(null);
  const [habitStatusMap, setHabitStatusMap] = useState<
    Map<string, HabitStatus>
  >(new Map());
  const api = useApi();
  const theme = useTheme();
  const { mutationVersion } = useMutation();
  const { filters } = useFilters();
  const isInitialMount = useRef(true);
  const { width } = useWindowDimensions();
  const useCompactDate = width < 400;

  // Apply filters to agenda entries and split into active/completed
  const filteredEntries = agenda ? filterTodos(agenda.entries, filters) : [];
  const doneStates = useMemo(() => todoStates?.done ?? [], [todoStates?.done]);

  // Check if a habit was completed today using habit status graph
  const isHabitCompletedToday = useCallback(
    (entry: Todo): boolean => {
      // First check the habit status map for the graph data
      if (entry.id) {
        const habitStatus = habitStatusMap.get(entry.id);
        if (habitStatus?.graph?.length) {
          // Find today's entry (status === "present")
          const todayEntry = habitStatus.graph.find(
            (e) => e.status === "present",
          );
          if (todayEntry) {
            return todayEntry.completionCount > 0;
          }
        }
      }
      // Fall back to entry's miniGraph if available
      const miniGraph = entry.habitSummary?.miniGraph;
      if (miniGraph?.length) {
        const todayEntry = miniGraph.find(
          (e: MiniGraphEntry) => e.completionNeededToday !== undefined,
        );
        if (todayEntry) {
          return todayEntry.completed;
        }
      }
      // Last fallback: if completionNeededToday is false, assume completed
      return entry.habitSummary?.completionNeededToday === false;
    },
    [habitStatusMap],
  );

  // Check if a habit needs completion today
  const habitNeedsCompletionToday = useCallback(
    (entry: Todo): boolean => {
      // First check the habit status map
      if (entry.id) {
        const habitStatus = habitStatusMap.get(entry.id);
        if (habitStatus?.currentState) {
          return habitStatus.currentState.completionNeededToday ?? false;
        }
      }
      // Fall back to habitSummary
      return entry.habitSummary?.completionNeededToday ?? false;
    },
    [habitStatusMap],
  );

  const isCompleted = useCallback(
    (entry: Todo & { completedAt?: string | null }) => {
      const isHabit =
        entry.isWindowHabit || entry.properties?.STYLE === "habit";
      if (isHabit) {
        return isHabitCompletedToday(entry);
      }
      return entry.completedAt || doneStates.includes(entry.todo);
    },
    [doneStates, isHabitCompletedToday],
  );

  // Filter out habits that don't need completion and weren't completed
  const shouldShowInAgenda = useCallback(
    (entry: Todo & { completedAt?: string | null }): boolean => {
      const isHabit =
        entry.isWindowHabit || entry.properties?.STYLE === "habit";
      if (isHabit) {
        const completedToday = isHabitCompletedToday(entry);
        const needsCompletion = habitNeedsCompletionToday(entry);
        // Show if: needs completion today OR was completed today
        return needsCompletion || completedToday;
      }
      return true; // Non-habits always show
    },
    [isHabitCompletedToday, habitNeedsCompletionToday],
  );

  const visibleEntries = filteredEntries.filter(shouldShowInAgenda);
  const activeEntries = sortEntriesForListView(
    visibleEntries.filter((entry) => !isCompleted(entry)),
  );
  const completedEntries = sortEntriesForListView(
    visibleEntries.filter((entry) => isCompleted(entry)),
  );

  // Build sections for week view
  const weekSections: WeekDaySection[] = useMemo(() => {
    if (!weekData?.days) return [];

    const todayString = formatDateForApi(new Date());

    return Object.entries(weekData.days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateString, entries]) => {
        const filtered = filterTodos(entries, filters);
        const displayEntries = showCompleted
          ? filtered
          : filtered.filter(
              (e) => !e.completedAt && !doneStates.includes(e.todo),
            );

        return {
          key: dateString,
          title: formatWeekDayHeader(dateString),
          dateString,
          isToday: dateString === todayString,
          data: displayEntries,
        };
      })
      .filter((section) => section.data.length > 0 || section.isToday);
  }, [weekData, filters, showCompleted, doneStates]);

  const handleTodoUpdated = useCallback(
    (todo: Todo, updates: Partial<Todo>) => {
      // Update day agenda
      setAgenda((prev) => {
        if (!prev) return prev;

        // If schedule changed, check if item should be removed from current view
        if (updates.scheduled !== undefined) {
          const currentDateStr = formatDateForApi(selectedDate);
          const newScheduledDate = updates.scheduled?.date;

          // If scheduled to a different day, remove from current view
          if (newScheduledDate && newScheduledDate !== currentDateStr) {
            return {
              ...prev,
              entries: prev.entries.filter(
                (entry) => getTodoKey(entry) !== getTodoKey(todo),
              ),
            };
          }
        }

        // Otherwise update in place
        return {
          ...prev,
          entries: prev.entries.map((entry) =>
            getTodoKey(entry) === getTodoKey(todo)
              ? { ...entry, ...updates }
              : entry,
          ),
        };
      });

      // Update week agenda
      setWeekData((prev) => {
        if (!prev) return prev;

        const newDays = { ...prev.days };
        for (const [dateStr, entries] of Object.entries(newDays)) {
          newDays[dateStr] = entries.map((entry) =>
            getTodoKey(entry) === getTodoKey(todo)
              ? { ...entry, ...updates }
              : entry,
          );
        }

        return { ...prev, days: newDays };
      });
    },
    [selectedDate],
  );

  const fetchAgenda = useCallback(
    async (date: Date, includeCompleted: boolean) => {
      if (!api) {
        return;
      }

      try {
        const dateString = formatDateForApi(date);
        const todayString = formatDateForApi(new Date());
        const includeOverdue = dateString <= todayString;
        const [agendaData, statesData, habitStatusesResponse] =
          await Promise.all([
            api.getAgenda("day", dateString, includeOverdue, includeCompleted),
            api.getTodoStates().catch(() => null),
            api.getAllHabitStatuses(14, 14).catch(() => null),
          ]);
        setAgenda(agendaData);
        if (statesData) {
          setTodoStates(statesData);
        }
        // Build a map of habit id -> status for quick lookup
        if (
          habitStatusesResponse?.status === "ok" &&
          habitStatusesResponse.habits
        ) {
          const statusMap = new Map<string, HabitStatus>();
          for (const status of habitStatusesResponse.habits) {
            if (status.id) {
              statusMap.set(status.id, status);
            }
          }
          setHabitStatusMap(statusMap);
        }
        setError(null);
      } catch (err) {
        console.error("Failed to load agenda:", err);
        setError("Failed to load agenda");
      }
    },
    [api],
  );

  const fetchWeekAgenda = useCallback(
    async (date: Date, includeCompleted: boolean) => {
      if (!api) {
        return;
      }

      try {
        const weekStart = getWeekStart(date);
        const dateString = formatDateForApi(weekStart);
        const [weekAgendaData, statesData] = await Promise.all([
          api.getAgenda("week", dateString, true, includeCompleted),
          api.getTodoStates().catch(() => null),
        ]);
        setWeekData(weekAgendaData);
        if (statesData) {
          setTodoStates(statesData);
        }
        setError(null);
      } catch (err) {
        console.error("Failed to load week agenda:", err);
        setError("Failed to load week agenda");
      }
    },
    [api],
  );

  // Reset showCompleted when date changes
  useEffect(() => {
    setShowCompleted(isPastDay(selectedDate));
  }, [selectedDate]);

  // Fetch data based on view mode
  useEffect(() => {
    if (viewMode === "week") {
      fetchWeekAgenda(selectedDate, showCompleted).finally(() =>
        setLoading(false),
      );
    } else {
      fetchAgenda(selectedDate, showCompleted).finally(() => setLoading(false));
    }
  }, [fetchAgenda, fetchWeekAgenda, selectedDate, showCompleted, viewMode]);

  // Refetch when mutations happen elsewhere
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (viewMode === "week") {
      fetchWeekAgenda(selectedDate, showCompleted);
    } else {
      fetchAgenda(selectedDate, showCompleted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutationVersion]);

  const goToPrevious = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - (viewMode === "week" ? 7 : 1));
    setSelectedDate(newDate);
  }, [selectedDate, viewMode]);

  const goToNext = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (viewMode === "week" ? 7 : 1));
    setSelectedDate(newDate);
  }, [selectedDate, viewMode]);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const cycleViewMode = useCallback(() => {
    setViewMode((prev) => {
      if (prev === "list") return "schedule";
      if (prev === "schedule") return "week";
      return "list";
    });
  }, []);

  const getViewModeIcon = () => {
    if (viewMode === "list") return "clock-outline";
    if (viewMode === "schedule") return "calendar-week";
    return "view-list";
  };

  const onDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(Platform.OS === "ios");
      if (date) {
        setSelectedDate(date);
      }
    },
    [],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (viewMode === "week") {
      await fetchWeekAgenda(selectedDate, showCompleted);
    } else {
      await fetchAgenda(selectedDate, showCompleted);
    }
    setRefreshing(false);
  }, [fetchAgenda, fetchWeekAgenda, selectedDate, showCompleted, viewMode]);

  if (loading) {
    return (
      <View
        testID="agendaLoadingView"
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator testID="agendaLoadingIndicator" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView
        testID="agendaErrorView"
        contentContainerStyle={[
          styles.centered,
          { backgroundColor: theme.colors.background, flexGrow: 1 },
        ]}
        style={{ backgroundColor: theme.colors.background }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text
          testID="agendaErrorText"
          variant="bodyLarge"
          style={{ color: theme.colors.error, marginBottom: 16 }}
        >
          {error}
        </Text>
        <IconButton
          icon="refresh"
          mode="contained"
          onPress={onRefresh}
          loading={refreshing}
          testID="agendaErrorRefreshButton"
        />
      </ScrollView>
    );
  }

  const isToday =
    formatDateForApi(selectedDate) === formatDateForApi(new Date());

  return (
    <TodoEditingProvider
      onTodoUpdated={handleTodoUpdated}
      todoStates={todoStates}
    >
      <View
        testID="agendaScreen"
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.header}>
          <View style={styles.dateNavigation}>
            <IconButton
              icon="chevron-left"
              onPress={goToPrevious}
              testID="agendaPrevDay"
            />
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={styles.dateButton}
              testID="agendaDateButton"
            >
              <Text
                testID="agendaDateHeader"
                variant="titleMedium"
                style={styles.dateText}
              >
                {viewMode === "week" && weekData
                  ? formatWeekRange(weekData.startDate, weekData.endDate)
                  : agenda?.date
                    ? formatDateForDisplay(agenda.date, useCompactDate)
                    : ""}
              </Text>
            </TouchableOpacity>
            <IconButton
              icon="chevron-right"
              onPress={goToNext}
              testID="agendaNextDay"
            />
            <IconButton
              icon={showCompleted ? "check-circle" : "check-circle-outline"}
              onPress={() => setShowCompleted(!showCompleted)}
              testID="agendaShowCompletedToggle"
            />
            <IconButton
              icon={getViewModeIcon()}
              onPress={cycleViewMode}
              testID="agendaViewModeToggle"
            />
            <IconButton
              icon="refresh"
              onPress={onRefresh}
              disabled={refreshing}
              testID="agendaRefreshButton"
            />
          </View>
          {!isToday && (
            <TouchableOpacity
              onPress={goToToday}
              style={styles.todayButton}
              testID="agendaTodayButton"
            >
              <Text style={{ color: theme.colors.primary }}>Go to Today</Text>
            </TouchableOpacity>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            testID="agendaDatePicker"
            value={selectedDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onDateChange}
          />
        )}

        <FilterBar testID="agendaFilterBar" />

        {viewMode === "week" ? (
          weekSections.length === 0 ? (
            <View testID="agendaEmptyView" style={styles.centered}>
              <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
                No items this week
              </Text>
            </View>
          ) : (
            <SectionList
              testID="weekList"
              sections={weekSections}
              keyExtractor={(item) => getTodoKey(item)}
              renderItem={({ item }) => {
                const completed =
                  item.completedAt || doneStates.includes(item.todo);
                return <TodoItem todo={item} opacity={completed ? 0.6 : 1} />;
              }}
              renderSectionHeader={({ section }) => (
                <View
                  style={[
                    styles.weekSectionHeader,
                    {
                      backgroundColor: section.isToday
                        ? theme.colors.primaryContainer
                        : theme.colors.surfaceVariant,
                    },
                  ]}
                >
                  <Text
                    variant="titleSmall"
                    style={{
                      color: section.isToday
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurfaceVariant,
                      fontWeight: section.isToday ? "bold" : "normal",
                    }}
                  >
                    {section.title}
                    {section.isToday && " (Today)"}
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={{
                      color: section.isToday
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.outline,
                    }}
                  >
                    {section.data.length} item
                    {section.data.length !== 1 && "s"}
                  </Text>
                </View>
              )}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              stickySectionHeadersEnabled={true}
            />
          )
        ) : activeEntries.length === 0 &&
          (!showCompleted || completedEntries.length === 0) ? (
          <View testID="agendaEmptyView" style={styles.centered}>
            <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
              No items for today
            </Text>
          </View>
        ) : viewMode === "schedule" ? (
          <DayScheduleView
            entries={showCompleted ? visibleEntries : activeEntries}
            doneStates={doneStates}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        ) : (
          <SectionList
            testID="agendaList"
            sections={[
              ...(activeEntries.length > 0
                ? [{ key: "active", data: activeEntries }]
                : []),
              ...(showCompleted && completedEntries.length > 0
                ? [
                    {
                      key: "completed",
                      title: "Completed",
                      data: completedEntries,
                    },
                  ]
                : []),
            ]}
            keyExtractor={(item) => getTodoKey(item)}
            renderItem={({ item, section }) => {
              const isHabit =
                item.isWindowHabit || item.properties?.STYLE === "habit";
              if (isHabit) {
                return <HabitItem todo={item} />;
              }
              return (
                <TodoItem
                  todo={item}
                  opacity={section.key === "completed" ? 0.6 : 1}
                />
              );
            }}
            renderSectionHeader={({ section }) =>
              section.title ? (
                <View
                  style={[
                    styles.sectionHeader,
                    { backgroundColor: theme.colors.background },
                  ]}
                >
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.outline }}
                  >
                    {section.title}
                  </Text>
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>
    </TodoEditingProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  dateNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dateButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  dateText: {
    textAlign: "center",
  },
  todayButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  sectionHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  weekSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
