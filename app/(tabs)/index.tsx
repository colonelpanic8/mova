import { DayScheduleView } from "@/components/DayScheduleView";
import { FilterBar } from "@/components/FilterBar";
import { HabitItem } from "@/components/HabitItem";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TodoItem, getTodoKey } from "@/components/TodoItem";
import { useApi } from "@/context/ApiContext";
import { useColorPalette } from "@/context/ColorPaletteContext";
import { useFilters } from "@/context/FilterContext";
import { useMutation } from "@/context/MutationContext";
import { useSettings } from "@/context/SettingsContext";
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
  Icon,
  IconButton,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";
/**
 * Get the default range start date based on settings.
 * Start = today - pastDays
 */
function getDefaultRangeStart(today: Date, pastDays: number): Date {
  const result = new Date(today);
  result.setDate(result.getDate() - pastDays);
  return result;
}

/**
 * Get the range end date based on start and length.
 * End = start + rangeLength - 1
 */
function getRangeEnd(startDate: Date, rangeLength: number): Date {
  const result = new Date(startDate);
  result.setDate(result.getDate() + rangeLength - 1);
  return result;
}

/**
 * Format a date range for display.
 */
function formatDateRange(startDate: string, endDate: string): string {
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
 * Format a date for multi-day view section headers.
 */
function formatMultiDayHeader(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface MultiDaySectionItem {
  key: string;
  title: string;
  dateString: string;
  isToday: boolean;
  data: AgendaEntry[];
}

interface CategoryHeader {
  type: "category-header";
  category: string;
  count: number;
  color: string;
}

type AgendaListItem = AgendaEntry | CategoryHeader;

/**
 * Sort entries for list view: habits without a scheduled time go to the bottom,
 * grouped together. Regular tasks and habits with scheduled times stay at the top
 * in their original order.
 */
function sortEntriesForListView<T extends Todo>(entries: T[]): T[] {
  const regularItems: T[] = [];
  const habitsWithoutTime: T[] = [];

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
  const [viewMode, setViewMode] = useState<"list" | "schedule" | "multiday">(
    "list",
  );
  const [viewModeMenuVisible, setViewModeMenuVisible] = useState(false);
  const [multiDayData, setMultiDayData] =
    useState<MultiDayAgendaResponse | null>(null);
  const [habitStatusMap, setHabitStatusMap] = useState<
    Map<string, HabitStatus>
  >(new Map());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );
  const api = useApi();
  const theme = useTheme();
  const { mutationVersion } = useMutation();
  const { filters } = useFilters();
  const { groupByCategory, multiDayRangeLength, multiDayPastDays } =
    useSettings();
  const { getCategoryColor } = useColorPalette();
  const isInitialMount = useRef(true);
  const { width } = useWindowDimensions();
  const useCompactDate = width < 400;

  // Apply filters to agenda entries and split into active/completed
  const baseFilteredEntries = agenda
    ? filterTodos(agenda.entries, filters)
    : [];
  const doneStates = useMemo(() => todoStates?.done ?? [], [todoStates?.done]);

  // Add synthetic entries for completed habits that aren't in the API response
  // (because their scheduled date moved forward after completion)
  const filteredEntries = useMemo(() => {
    const selectedDateString = formatDateForApi(selectedDate);
    const existingIds = new Set(
      baseFilteredEntries.filter((e) => e.id).map((e) => e.id),
    );

    const completedHabitsToAdd: AgendaEntry[] = [];
    habitStatusMap.forEach((status) => {
      // Skip if already in the entries
      if (existingIds.has(status.id)) return;

      // Check if this habit was completed on the selected date
      // First try the graph data
      const graphEntry = status.graph?.find(
        (e) => e.date === selectedDateString,
      );
      let wasCompletedOnDate = graphEntry && graphEntry.completionCount > 0;

      // Also check doneTimes array for completions on this date
      // (handles case where graph doesn't include entry for dates after habit was rescheduled)
      if (!wasCompletedOnDate && status.doneTimes?.length) {
        wasCompletedOnDate = status.doneTimes.some((doneTime) => {
          // doneTimes are ISO timestamps - extract date portion
          const doneDate = doneTime.split("T")[0];
          return doneDate === selectedDateString;
        });
      }

      if (wasCompletedOnDate) {
        completedHabitsToAdd.push({
          id: status.id,
          title: status.title,
          isWindowHabit: true,
          agendaLine: status.title,
          file: null,
          pos: null,
          level: 1,
          todo: "DONE",
          tags: null,
          scheduled: null,
          deadline: null,
          priority: null,
          olpath: null,
          notifyBefore: null,
          category: null,
          effectiveCategory: null,
          habitSummary: status.currentState,
        });
      }
    });

    return [...baseFilteredEntries, ...completedHabitsToAdd];
  }, [baseFilteredEntries, habitStatusMap, selectedDate]);

  // Check if a habit was completed on a specific date using habit status graph
  const isHabitCompletedOnDate = useCallback(
    (entry: Todo, dateString: string): boolean => {
      // First check the habit status map for the graph data
      if (entry.id) {
        const habitStatus = habitStatusMap.get(entry.id);
        if (habitStatus?.graph?.length) {
          const dateEntry = habitStatus.graph.find(
            (e) => e.date === dateString,
          );
          if (dateEntry) {
            return dateEntry.completionCount > 0;
          }
        }
      }
      // Fall back to entry's miniGraph if available
      const miniGraph = entry.habitSummary?.miniGraph;
      if (miniGraph?.length) {
        const dateEntry = miniGraph.find(
          (e: MiniGraphEntry) => e.date === dateString,
        );
        if (dateEntry) {
          return dateEntry.completed;
        }
      }
      return false;
    },
    [habitStatusMap],
  );

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
      // Cannot determine completion status, default to not completed
      return false;
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
        // Check completion for the selected date, not just today
        const selectedDateString = formatDateForApi(selectedDate);
        return isHabitCompletedOnDate(entry, selectedDateString);
      }
      return entry.completedAt || doneStates.includes(entry.todo);
    },
    [doneStates, isHabitCompletedOnDate, selectedDate],
  );

  // Filter out habits that don't need completion and weren't completed
  // Note: For future dates, habits returned by API are scheduled for that date, so show them
  const shouldShowInAgenda = useCallback(
    (entry: Todo & { completedAt?: string | null }): boolean => {
      const isHabit =
        entry.isWindowHabit || entry.properties?.STYLE === "habit";
      if (isHabit) {
        const todayString = formatDateForApi(new Date());
        const selectedDateString = formatDateForApi(selectedDate);

        // For future dates, show habits that are in the API response
        // (they're returned because they're scheduled/deadline for that date)
        if (selectedDateString > todayString) {
          return true;
        }

        // For today, apply the usual logic
        const completedToday = isHabitCompletedToday(entry);
        const needsCompletion = habitNeedsCompletionToday(entry);
        // Show if: needs completion today OR was completed today
        return needsCompletion || completedToday;
      }
      return true; // Non-habits always show
    },
    [isHabitCompletedToday, habitNeedsCompletionToday, selectedDate],
  );

  const visibleEntries = filteredEntries.filter(shouldShowInAgenda);
  const activeEntries = sortEntriesForListView(
    visibleEntries.filter((entry) => !isCompleted(entry)),
  );
  const completedEntries = sortEntriesForListView(
    visibleEntries.filter((entry) => isCompleted(entry)),
  );

  const toggleCategoryCollapse = useCallback((categoryKey: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      return next;
    });
  }, []);

  const groupItemsByCategory = useCallback(
    (items: AgendaEntry[]): AgendaListItem[] => {
      if (!groupByCategory) return items;

      const categoryMap = new Map<string, AgendaEntry[]>();
      items.forEach((item) => {
        const category = item.effectiveCategory || "Uncategorized";
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(item);
      });

      const result: AgendaListItem[] = [];
      Array.from(categoryMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([category, categoryItems]) => {
          result.push({
            type: "category-header",
            category,
            count: categoryItems.length,
            color: getCategoryColor(category),
          });
          const categoryKey = `category:${category}`;
          if (!collapsedCategories.has(categoryKey)) {
            result.push(...categoryItems);
          }
        });

      return result;
    },
    [groupByCategory, getCategoryColor, collapsedCategories],
  );

  // Build sections for multi-day view
  const multiDaySections: MultiDaySectionItem[] = useMemo(() => {
    if (!multiDayData?.days) return [];

    const todayString = formatDateForApi(new Date());

    // Build maps of date -> habits for prospective and completed habits
    const prospectiveHabitsByDate = new Map<string, AgendaEntry[]>();
    const completedHabitsByDate = new Map<string, AgendaEntry[]>();

    habitStatusMap.forEach((status) => {
      status.graph?.forEach((graphEntry) => {
        const dateStr = graphEntry.date;

        // Create a synthetic AgendaEntry for this habit on this date
        const createSyntheticEntry = (todo: string): AgendaEntry => ({
          id: status.id,
          title: status.title,
          isWindowHabit: true,
          agendaLine: status.title,
          file: null,
          pos: null,
          level: 1,
          todo,
          tags: null,
          scheduled: null,
          deadline: null,
          priority: null,
          olpath: null,
          notifyBefore: null,
          category: null,
          effectiveCategory: null,
          habitSummary: status.currentState,
        });

        // Track prospective habits (need completion on this date)
        if (graphEntry.completionExpectedToday) {
          if (!prospectiveHabitsByDate.has(dateStr)) {
            prospectiveHabitsByDate.set(dateStr, []);
          }
          prospectiveHabitsByDate
            .get(dateStr)!
            .push(createSyntheticEntry("TODO"));
        }

        // Track completed habits (completed on this date)
        if (graphEntry.completionCount > 0) {
          if (!completedHabitsByDate.has(dateStr)) {
            completedHabitsByDate.set(dateStr, []);
          }
          completedHabitsByDate
            .get(dateStr)!
            .push(createSyntheticEntry("DONE"));
        }
      });
    });

    return Object.entries(multiDayData.days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateString, entries]) => {
        const filtered = filterTodos(entries, filters);

        // Get prospective and completed habits for this date
        const prospectiveHabits = prospectiveHabitsByDate.get(dateString) || [];
        const completedHabits = completedHabitsByDate.get(dateString) || [];

        // Merge habits with existing entries, avoiding duplicates
        const existingIds = new Set(
          filtered.filter((e) => e.id).map((e) => e.id),
        );
        const newProspectiveHabits = prospectiveHabits.filter(
          (h) => !existingIds.has(h.id),
        );
        // Add prospective habits to the set to avoid duplicating with completed
        newProspectiveHabits.forEach((h) => existingIds.add(h.id));
        const newCompletedHabits = completedHabits.filter(
          (h) => !existingIds.has(h.id),
        );
        const mergedEntries = [
          ...filtered,
          ...newProspectiveHabits,
          ...newCompletedHabits,
        ];

        const displayEntries = showCompleted
          ? mergedEntries
          : mergedEntries.filter((e) => {
              const isHabit =
                e.isWindowHabit || e.properties?.STYLE === "habit";
              if (isHabit) {
                // For habits, check completion using miniGraph/habitStatusMap
                return !isHabitCompletedOnDate(e, dateString);
              }
              return !e.completedAt && !doneStates.includes(e.todo);
            });

        return {
          key: dateString,
          title: formatMultiDayHeader(dateString),
          dateString,
          isToday: dateString === todayString,
          data: displayEntries,
        };
      })
      .filter((section) => section.data.length > 0 || section.isToday);
  }, [
    multiDayData,
    filters,
    showCompleted,
    doneStates,
    isHabitCompletedOnDate,
    habitStatusMap,
  ]);

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

      // Update multi-day agenda
      setMultiDayData((prev) => {
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
        // Use multi-day endpoint even for single day to get prospective habit scheduling
        // The multi-day endpoint uses org-window-habit-get-future-required-intervals
        // which projects future required completion dates for habits
        const [multiDayData, statesData, habitStatusesResponse] =
          await Promise.all([
            api.getAgenda(
              "week",
              dateString,
              includeOverdue,
              includeCompleted,
              dateString,
            ),
            api.getTodoStates().catch(() => null),
            api.getAllHabitStatuses(14, 14).catch(() => null),
          ]);
        // Convert multi-day response to single-day format
        const entries = multiDayData.days[dateString] || [];
        const agendaData: SingleDayAgendaResponse = {
          span: "day",
          date: dateString,
          entries,
        };
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

  const fetchMultiDayAgenda = useCallback(
    async (startDate: Date, rangeLength: number, includeCompleted: boolean) => {
      if (!api) {
        return;
      }

      try {
        const startDateString = formatDateForApi(startDate);
        const endDate = getRangeEnd(startDate, rangeLength);
        const endDateString = formatDateForApi(endDate);
        const [multiDayAgendaData, statesData, habitStatusesResponse] =
          await Promise.all([
            api.getAgenda(
              "week",
              startDateString,
              true,
              includeCompleted,
              endDateString,
            ),
            api.getTodoStates().catch(() => null),
            api.getAllHabitStatuses(14, 14).catch(() => null),
          ]);
        setMultiDayData(multiDayAgendaData);
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
        console.error("Failed to load multi-day agenda:", err);
        setError("Failed to load multi-day agenda");
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
    if (viewMode === "multiday") {
      fetchMultiDayAgenda(
        selectedDate,
        multiDayRangeLength,
        showCompleted,
      ).finally(() => setLoading(false));
    } else {
      fetchAgenda(selectedDate, showCompleted).finally(() => setLoading(false));
    }
  }, [
    fetchAgenda,
    fetchMultiDayAgenda,
    selectedDate,
    showCompleted,
    viewMode,
    multiDayRangeLength,
  ]);

  // Refetch when mutations happen elsewhere
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (viewMode === "multiday") {
      fetchMultiDayAgenda(selectedDate, multiDayRangeLength, showCompleted);
    } else {
      fetchAgenda(selectedDate, showCompleted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutationVersion]);

  const goToPrevious = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(
      newDate.getDate() - (viewMode === "multiday" ? multiDayRangeLength : 1),
    );
    setSelectedDate(newDate);
  }, [selectedDate, viewMode, multiDayRangeLength]);

  const goToNext = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(
      newDate.getDate() + (viewMode === "multiday" ? multiDayRangeLength : 1),
    );
    setSelectedDate(newDate);
  }, [selectedDate, viewMode, multiDayRangeLength]);

  const goToToday = useCallback(() => {
    if (viewMode === "multiday") {
      setSelectedDate(getDefaultRangeStart(new Date(), multiDayPastDays));
    } else {
      setSelectedDate(new Date());
    }
  }, [viewMode, multiDayPastDays]);

  const getViewModeIcon = () => {
    if (viewMode === "list") return "view-list";
    if (viewMode === "schedule") return "clock-outline";
    return "calendar-range";
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
    if (viewMode === "multiday") {
      await fetchMultiDayAgenda(
        selectedDate,
        multiDayRangeLength,
        showCompleted,
      );
    } else {
      await fetchAgenda(selectedDate, showCompleted);
    }
    setRefreshing(false);
  }, [
    fetchAgenda,
    fetchMultiDayAgenda,
    selectedDate,
    showCompleted,
    viewMode,
    multiDayRangeLength,
  ]);

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
      <ScreenContainer testID="agendaScreen">
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
                {viewMode === "multiday" && multiDayData
                  ? formatDateRange(
                      multiDayData.startDate,
                      multiDayData.endDate,
                    )
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
            <Menu
              visible={viewModeMenuVisible}
              onDismiss={() => setViewModeMenuVisible(false)}
              anchor={
                <IconButton
                  icon={getViewModeIcon()}
                  onPress={() => setViewModeMenuVisible(true)}
                  testID="agendaViewModeToggle"
                />
              }
            >
              <Menu.Item
                leadingIcon="view-list"
                onPress={() => {
                  setViewMode("list");
                  setViewModeMenuVisible(false);
                }}
                title="List"
                testID="viewModeList"
              />
              <Menu.Item
                leadingIcon="clock-outline"
                onPress={() => {
                  setViewMode("schedule");
                  setViewModeMenuVisible(false);
                }}
                title="Schedule"
                testID="viewModeSchedule"
              />
              <Menu.Item
                leadingIcon="calendar-range"
                onPress={() => {
                  setViewMode("multiday");
                  setViewModeMenuVisible(false);
                }}
                title="Multi-day"
                testID="viewModeMultiday"
              />
            </Menu>
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

        {viewMode === "multiday" ? (
          multiDaySections.length === 0 ? (
            <View testID="agendaEmptyView" style={styles.centered}>
              <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
                No items in this range
              </Text>
            </View>
          ) : (
            <SectionList
              testID="multiDayList"
              sections={multiDaySections}
              keyExtractor={(item) => getTodoKey(item)}
              renderItem={({ item, section }) => {
                const isHabit =
                  item.isWindowHabit || item.properties?.STYLE === "habit";
                const completed = isHabit
                  ? isHabitCompletedOnDate(item, section.dateString)
                  : item.completedAt || doneStates.includes(item.todo);
                return <TodoItem todo={item} opacity={completed ? 0.6 : 1} />;
              }}
              renderSectionHeader={({ section }) => (
                <View
                  style={[
                    styles.multiDaySectionHeader,
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
          <SectionList<AgendaListItem>
            testID="agendaList"
            sections={[
              ...(activeEntries.length > 0
                ? [
                    {
                      key: "active",
                      data: groupItemsByCategory(activeEntries),
                    },
                  ]
                : []),
              ...(showCompleted && completedEntries.length > 0
                ? [
                    {
                      key: "completed",
                      title: "Completed",
                      data: groupItemsByCategory(completedEntries),
                    },
                  ]
                : []),
            ]}
            keyExtractor={(item) =>
              "type" in item && item.type === "category-header"
                ? `header-${item.category}`
                : getTodoKey(item as AgendaEntry)
            }
            renderItem={({ item, section }) => {
              // Handle category headers
              if ("type" in item && item.type === "category-header") {
                const categoryKey = `category:${item.category}`;
                const isCollapsed = collapsedCategories.has(categoryKey);
                return (
                  <TouchableOpacity
                    onPress={() => toggleCategoryCollapse(categoryKey)}
                    style={[
                      styles.categoryHeader,
                      {
                        borderLeftColor: item.color,
                        backgroundColor: theme.colors.surface,
                      },
                    ]}
                    testID={`categoryHeader-${item.category}`}
                  >
                    <View style={styles.categoryHeaderLeft}>
                      <Icon
                        source={isCollapsed ? "chevron-right" : "chevron-down"}
                        size={20}
                        color={theme.colors.onSurface}
                      />
                      <Text
                        style={[
                          styles.categoryHeaderText,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        {item.category}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.categoryHeaderCount,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {item.count}
                    </Text>
                  </TouchableOpacity>
                );
              }

              // Handle regular items
              const todoItem = item as AgendaEntry;
              const isHabit =
                todoItem.isWindowHabit ||
                todoItem.properties?.STYLE === "habit";
              if (isHabit) {
                return <HabitItem todo={todoItem} />;
              }
              return (
                <TodoItem
                  todo={todoItem}
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
      </ScreenContainer>
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
  multiDaySectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  categoryHeaderCount: {
    fontSize: 12,
  },
});
