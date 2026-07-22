import { DayScheduleView } from "@/components/DayScheduleView";
import { FilterBar } from "@/components/FilterBar";
import { HabitItem } from "@/components/HabitItem";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TodoItem } from "@/components/TodoItem";
import { useColorPalette } from "@/context/ColorPaletteContext";
import { useFilters } from "@/context/FilterContext";
import { useSettings } from "@/context/SettingsContext";
import { useAgendaData } from "@/hooks/useAgendaData";
import { useHabitStatuses, useTodoStates } from "@/hooks/useServerData";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import { AgendaEntry, HabitStatus, MiniGraphEntry, Todo } from "@/services/api";
import {
  formatLocalDate as formatDateForApi,
  formatDateForDisplay,
  isPastDay,
} from "@/utils/dateFormatting";
import { filterTodos } from "@/utils/filterTodos";
import { isHabitTodo } from "@/utils/habits";
import { formatRelativeTime } from "@/utils/timeFormatting";
import { getTodoKey } from "@/utils/todoKey";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

/**
 * Create a synthetic AgendaEntry for a habit that isn't in the API agenda
 * response (e.g. because its scheduled date moved forward after completion).
 */
function createSyntheticHabitEntry(
  status: HabitStatus,
  todo: string,
): AgendaEntry {
  return {
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
  };
}

/** Build a map of habit id -> status for quick lookup. */
function buildHabitStatusMap(
  statuses: HabitStatus[],
): Map<string, HabitStatus> {
  const statusMap = new Map<string, HabitStatus>();
  for (const status of statuses) {
    if (status.id) {
      statusMap.set(status.id, status);
    }
  }
  return statusMap;
}

/** Human-friendly age of the currently displayed data, for the stale banner. */
function formatFetchedAgo(dataUpdatedAt: number): string {
  if (!Number.isFinite(dataUpdatedAt) || dataUpdatedAt <= 0) {
    return "earlier";
  }
  return formatRelativeTime(new Date(dataUpdatedAt));
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
    const isHabit = isHabitTodo(entry);
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
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCompleted, setShowCompleted] = useState<boolean>(() =>
    isPastDay(new Date()),
  );
  const [viewMode, setViewMode] = useState<"list" | "schedule" | "multiday">(
    "list",
  );
  const [viewModeMenuVisible, setViewModeMenuVisible] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );
  const theme = useTheme();
  const { filters } = useFilters();
  const { groupByCategory, multiDayRangeLength, multiDayPastDays } =
    useSettings();
  const { getCategoryColor } = useColorPalette();
  const { width } = useWindowDimensions();
  const useCompactDate = width < 400;

  // Server state: the agenda view plus its supporting lookups. All of it is
  // cached per server identity and persisted for offline launches.
  const {
    agenda,
    multiDayData,
    isLoading: loading,
    error,
    dataUpdatedAt,
    refetch,
    updateTodoInView,
  } = useAgendaData({
    mode: viewMode === "multiday" ? "multiday" : "day",
    date: selectedDate,
    rangeLength: multiDayRangeLength,
    includeCompleted: showCompleted,
  });
  const todoStatesQuery = useTodoStates();
  const todoStates = todoStatesQuery.data ?? null;
  const { refetch: refetchTodoStates } = todoStatesQuery;
  const habitStatusesQuery = useHabitStatuses(14, 14);
  const { refetch: refetchHabitStatuses } = habitStatusesQuery;
  const habitStatusMap = useMemo(
    () => buildHabitStatusMap(habitStatusesQuery.data ?? []),
    [habitStatusesQuery.data],
  );

  // Whether the current view mode has anything to render (from a previous
  // fetch or from the persisted cache). Used to decide between full-screen
  // loading/error states and non-destructive inline indicators.
  const hasData = viewMode === "multiday" ? multiDayData !== null : !!agenda;

  // Apply filters to agenda entries and split into active/completed
  const baseFilteredEntries = useMemo(
    () => (agenda ? filterTodos(agenda.entries, filters) : []),
    [agenda, filters],
  );
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
        completedHabitsToAdd.push(createSyntheticHabitEntry(status, "DONE"));
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

  // Check if a habit needs completion on a specific date
  const habitNeedsCompletionOnDate = useCallback(
    (entry: Todo, dateString: string): boolean => {
      // First check the habit status map for graph data
      if (entry.id) {
        const habitStatus = habitStatusMap.get(entry.id);
        if (habitStatus?.graph?.length) {
          const dateEntry = habitStatus.graph.find(
            (e) => e.date === dateString,
          );
          if (dateEntry) {
            return dateEntry.completionExpectedToday ?? false;
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
          return dateEntry.completionNeededToday ?? false;
        }
      }
      return false;
    },
    [habitStatusMap],
  );

  const isCompleted = useCallback(
    (entry: Todo & { completedAt?: string | null }) => {
      if (isHabitTodo(entry)) {
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
      if (isHabitTodo(entry)) {
        const todayString = formatDateForApi(new Date());
        const selectedDateString = formatDateForApi(selectedDate);

        // For future dates, show habits that are in the API response
        // (they're returned because they're scheduled/deadline for that date)
        if (selectedDateString > todayString) {
          return true;
        }

        const completedOnSelectedDate = isHabitCompletedOnDate(
          entry,
          selectedDateString,
        );
        const needsCompletionOnSelectedDate = habitNeedsCompletionOnDate(
          entry,
          selectedDateString,
        );
        // Show if: needs completion on selected date OR was completed on selected date
        return completedOnSelectedDate || needsCompletionOnSelectedDate;
      }
      return true; // Non-habits always show
    },
    [habitNeedsCompletionOnDate, isHabitCompletedOnDate, selectedDate],
  );

  const visibleEntries = useMemo(
    () => filteredEntries.filter(shouldShowInAgenda),
    [filteredEntries, shouldShowInAgenda],
  );
  const activeEntries = useMemo(
    () =>
      sortEntriesForListView(
        visibleEntries.filter((entry) => !isCompleted(entry)),
      ),
    [visibleEntries, isCompleted],
  );
  const completedEntries = useMemo(
    () =>
      sortEntriesForListView(
        visibleEntries.filter((entry) => isCompleted(entry)),
      ),
    [visibleEntries, isCompleted],
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

  // Sections for the single-day list view (active + optional completed)
  const listSections = useMemo(
    (): { key: string; title?: string; data: AgendaListItem[] }[] => [
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
    ],
    [activeEntries, completedEntries, showCompleted, groupItemsByCategory],
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

        // Track prospective habits (need completion on this date)
        if (graphEntry.completionExpectedToday) {
          if (!prospectiveHabitsByDate.has(dateStr)) {
            prospectiveHabitsByDate.set(dateStr, []);
          }
          prospectiveHabitsByDate
            .get(dateStr)!
            .push(createSyntheticHabitEntry(status, "TODO"));
        }

        // Track completed habits (completed on this date)
        if (graphEntry.completionCount > 0) {
          if (!completedHabitsByDate.has(dateStr)) {
            completedHabitsByDate.set(dateStr, []);
          }
          completedHabitsByDate
            .get(dateStr)!
            .push(createSyntheticHabitEntry(status, "DONE"));
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
              if (isHabitTodo(e)) {
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

  // Reset showCompleted when date changes
  useEffect(() => {
    setShowCompleted(isPastDay(selectedDate));
  }, [selectedDate]);

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
    await Promise.all([refetch(), refetchTodoStates(), refetchHabitStatuses()]);
    setRefreshing(false);
  }, [refetch, refetchTodoStates, refetchHabitStatuses]);

  // Full-screen spinner only when there is nothing to render yet (no cached
  // or in-memory data).
  if (loading && !hasData) {
    return (
      <View
        testID="agendaLoadingView"
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator testID="agendaLoadingIndicator" size="large" />
      </View>
    );
  }

  // Full-screen error only when there is no data at all; if anything is
  // displayed (cached or from a previous fetch), keep it and show a
  // non-destructive banner instead (below).
  if (error && !hasData) {
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
      onTodoUpdated={updateTodoInView}
      todoStates={todoStates}
    >
      <ScreenContainer testID="agendaScreen">
        <View
          style={[
            styles.header,
            { borderBottomColor: theme.colors.outlineVariant },
          ]}
        >
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

        {error != null && (
          <View
            testID="agendaStaleBanner"
            style={[
              styles.staleBanner,
              { backgroundColor: theme.colors.errorContainer },
            ]}
          >
            <Text
              testID="agendaStaleBannerText"
              variant="bodySmall"
              style={[
                styles.staleBannerText,
                { color: theme.colors.onErrorContainer },
              ]}
            >
              {`Couldn't refresh — showing data from ${formatFetchedAgo(dataUpdatedAt)}`}
            </Text>
            <IconButton
              icon="refresh"
              size={16}
              iconColor={theme.colors.onErrorContainer}
              onPress={onRefresh}
              disabled={refreshing}
              testID="agendaStaleBannerRetry"
            />
          </View>
        )}

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
                const completed = isHabitTodo(item)
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
            sections={listSections}
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
              if (isHabitTodo(todoItem)) {
                return (
                  <HabitItem
                    todo={todoItem}
                    habitStatus={
                      todoItem.id ? habitStatusMap.get(todoItem.id) : undefined
                    }
                  />
                );
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
                    {
                      backgroundColor: theme.colors.background,
                      borderBottomColor: theme.colors.outlineVariant,
                    },
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
  staleBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingVertical: 2,
  },
  staleBannerText: {
    flex: 1,
  },
});
