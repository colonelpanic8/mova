import { AgendaHeader, AgendaViewMode } from "@/components/agenda/AgendaHeader";
import {
  AgendaList,
  AgendaListSection,
  groupItemsByCategory,
} from "@/components/agenda/AgendaList";
import { MultiDayAgendaList } from "@/components/agenda/MultiDayAgendaList";
import { StaleBanner } from "@/components/agenda/StaleBanner";
import { DayScheduleView } from "@/components/DayScheduleView";
import { FilterBar } from "@/components/FilterBar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useColorPalette } from "@/context/ColorPaletteContext";
import { useFilters } from "@/context/FilterContext";
import { useSettings } from "@/context/SettingsContext";
import { useAgendaData } from "@/hooks/useAgendaData";
import { useHabitStatuses, useTodoStates } from "@/hooks/useServerData";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import { Todo } from "@/services/api";
import {
  formatLocalDate as formatDateForApi,
  formatDateForDisplay,
  formatDateRange,
  getDefaultRangeStart,
  isPastDay,
} from "@/utils/dateFormatting";
import { filterTodos } from "@/utils/filterTodos";
import {
  buildHabitStatusMap,
  buildMultiDaySections,
  collectCompletedSyntheticHabits,
  isEntryCompleted,
  isHabitCompletedOnDate as isHabitCompletedOnDateForMap,
  MultiDaySectionItem,
  shouldShowEntryOnDate,
  sortEntriesForListView,
} from "@/utils/habitAgenda";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActivityIndicator,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

export default function AgendaScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCompleted, setShowCompleted] = useState<boolean>(() =>
    isPastDay(new Date()),
  );
  const [viewMode, setViewMode] = useState<AgendaViewMode>("list");
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
  const filteredEntries = useMemo(
    () => [
      ...baseFilteredEntries,
      ...collectCompletedSyntheticHabits(
        baseFilteredEntries,
        habitStatusMap,
        formatDateForApi(selectedDate),
      ),
    ],
    [baseFilteredEntries, habitStatusMap, selectedDate],
  );

  // Check if a habit was completed on a specific date using habit status graph
  const isHabitCompletedOnDate = useCallback(
    (entry: Todo, dateString: string): boolean =>
      isHabitCompletedOnDateForMap(entry, dateString, habitStatusMap),
    [habitStatusMap],
  );

  // Completed on the selected date (habits resolve per-date completion)
  const isCompleted = useCallback(
    (entry: Todo & { completedAt?: string | null }) =>
      isEntryCompleted(
        entry,
        formatDateForApi(selectedDate),
        doneStates,
        habitStatusMap,
      ),
    [doneStates, habitStatusMap, selectedDate],
  );

  // Filter out habits that don't need completion and weren't completed
  const shouldShowInAgenda = useCallback(
    (entry: Todo & { completedAt?: string | null }): boolean =>
      shouldShowEntryOnDate(
        entry,
        formatDateForApi(selectedDate),
        formatDateForApi(new Date()),
        habitStatusMap,
      ),
    [habitStatusMap, selectedDate],
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

  // Sections for the single-day list view (active + optional completed),
  // with category header rows interleaved when grouping is enabled.
  const listSections = useMemo((): AgendaListSection[] => {
    const groupingOptions = {
      groupByCategory,
      collapsedCategories,
      getCategoryColor,
    };
    return [
      ...(activeEntries.length > 0
        ? [
            {
              key: "active",
              data: groupItemsByCategory(activeEntries, groupingOptions),
            },
          ]
        : []),
      ...(showCompleted && completedEntries.length > 0
        ? [
            {
              key: "completed",
              title: "Completed",
              data: groupItemsByCategory(completedEntries, groupingOptions),
            },
          ]
        : []),
    ];
  }, [
    activeEntries,
    completedEntries,
    showCompleted,
    groupByCategory,
    collapsedCategories,
    getCategoryColor,
  ]);

  // Build sections for multi-day view
  const multiDaySections: MultiDaySectionItem[] = useMemo(() => {
    if (!multiDayData?.days) return [];
    return buildMultiDaySections(multiDayData.days, {
      filters,
      showCompleted,
      doneStates,
      habitStatusMap,
      todayString: formatDateForApi(new Date()),
    });
  }, [multiDayData, filters, showCompleted, doneStates, habitStatusMap]);

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

  const dateLabel =
    viewMode === "multiday" && multiDayData
      ? formatDateRange(multiDayData.startDate, multiDayData.endDate)
      : agenda?.date
        ? formatDateForDisplay(agenda.date, useCompactDate)
        : "";

  return (
    <TodoEditingProvider
      onTodoUpdated={updateTodoInView}
      todoStates={todoStates}
    >
      <ScreenContainer testID="agendaScreen">
        <AgendaHeader
          dateLabel={dateLabel}
          isToday={isToday}
          showCompleted={showCompleted}
          viewMode={viewMode}
          refreshing={refreshing}
          onPrevious={goToPrevious}
          onNext={goToNext}
          onToday={goToToday}
          onShowDatePicker={() => setShowDatePicker(true)}
          onToggleShowCompleted={() => setShowCompleted(!showCompleted)}
          onSelectViewMode={setViewMode}
          onRefresh={onRefresh}
        />

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
          <StaleBanner
            dataUpdatedAt={dataUpdatedAt}
            refreshing={refreshing}
            onRetry={onRefresh}
          />
        )}

        {viewMode === "multiday" ? (
          multiDaySections.length === 0 ? (
            <View testID="agendaEmptyView" style={styles.centered}>
              <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
                No items in this range
              </Text>
            </View>
          ) : (
            <MultiDayAgendaList
              sections={multiDaySections}
              doneStates={doneStates}
              isHabitCompletedOnDate={isHabitCompletedOnDate}
              refreshing={refreshing}
              onRefresh={onRefresh}
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
          <AgendaList
            sections={listSections}
            habitStatusMap={habitStatusMap}
            collapsedCategories={collapsedCategories}
            onToggleCategory={toggleCategoryCollapse}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </ScreenContainer>
    </TodoEditingProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
