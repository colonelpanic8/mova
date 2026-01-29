import { FilterBar } from "@/components/FilterBar";
import { TodoItem, getTodoKey } from "@/components/TodoItem";
import { useApi } from "@/context/ApiContext";
import { useFilters } from "@/context/FilterContext";
import { useMutation } from "@/context/MutationContext";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import {
  AgendaEntry,
  MultiDayAgendaResponse,
  Todo,
  TodoStatesResponse,
} from "@/services/api";
import { formatLocalDate as formatDateForApi } from "@/utils/dateFormatting";
import { filterTodos } from "@/utils/filterTodos";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Chip,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

interface DaySection {
  key: string;
  title: string;
  dateString: string;
  isToday: boolean;
  data: AgendaEntry[];
}

export default function WeekAgendaScreen() {
  const [weekData, setWeekData] = useState<MultiDayAgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    // Start from beginning of current week (Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek);
    return start;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const api = useApi();
  const theme = useTheme();
  const { mutationVersion } = useMutation();
  const { filters } = useFilters();
  const isInitialMount = useRef(true);
  const sectionListRef = useRef<SectionList>(null);

  const doneStates = todoStates?.done ?? [];

  const isCompleted = useCallback(
    (entry: AgendaEntry) =>
      entry.completedAt || doneStates.includes(entry.todo),
    [doneStates],
  );

  // Build sections from week data
  const sections: DaySection[] = React.useMemo(() => {
    if (!weekData) return [];

    const todayString = formatDateForApi(new Date());

    return Object.entries(weekData.days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateString, entries]) => {
        const filtered = filterTodos(entries, filters);
        const displayEntries = showCompleted
          ? filtered
          : filtered.filter((e) => !isCompleted(e));

        return {
          key: dateString,
          title: formatDateForDisplay(dateString),
          dateString,
          isToday: dateString === todayString,
          data: displayEntries,
        };
      })
      .filter((section) => section.data.length > 0 || section.isToday);
  }, [weekData, filters, showCompleted, isCompleted]);

  const handleTodoUpdated = useCallback(
    (todo: Todo, updates: Partial<Todo>) => {
      setWeekData((prev) => {
        if (!prev) return prev;

        const newDays = { ...prev.days };

        // Update the todo in all days where it appears
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
    [],
  );

  const fetchWeekAgenda = useCallback(
    async (startDate: Date, includeCompleted: boolean) => {
      if (!api) {
        return;
      }

      try {
        const dateString = formatDateForApi(startDate);
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

  useEffect(() => {
    fetchWeekAgenda(weekStartDate, showCompleted).finally(() =>
      setLoading(false),
    );
  }, [fetchWeekAgenda, weekStartDate, showCompleted]);

  // Refetch when mutations happen elsewhere
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchWeekAgenda(weekStartDate, showCompleted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutationVersion]);

  const goToPreviousWeek = useCallback(() => {
    setWeekStartDate((prev) => addDays(prev, -7));
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekStartDate((prev) => addDays(prev, 7));
  }, []);

  const goToCurrentWeek = useCallback(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek);
    setWeekStartDate(start);
  }, []);

  const scrollToToday = useCallback(() => {
    const todayString = formatDateForApi(new Date());
    const todayIndex = sections.findIndex((s) => s.dateString === todayString);
    if (todayIndex >= 0 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex: todayIndex,
        itemIndex: 0,
        animated: true,
        viewOffset: 0,
      });
    }
  }, [sections]);

  const onDateChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(Platform.OS === "ios");
      if (date) {
        // Start from beginning of selected week
        const dayOfWeek = date.getDay();
        const start = new Date(date);
        start.setDate(date.getDate() - dayOfWeek);
        setWeekStartDate(start);
      }
    },
    [],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWeekAgenda(weekStartDate, showCompleted);
    setRefreshing(false);
  }, [fetchWeekAgenda, weekStartDate, showCompleted]);

  if (loading) {
    return (
      <View
        testID="weekLoadingView"
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator testID="weekLoadingIndicator" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView
        testID="weekErrorView"
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
          testID="weekErrorText"
          variant="bodyLarge"
          style={{ color: theme.colors.error }}
        >
          {error}
        </Text>
      </ScrollView>
    );
  }

  const isCurrentWeek =
    weekData &&
    formatDateForApi(new Date()) >= weekData.startDate &&
    formatDateForApi(new Date()) <= weekData.endDate;

  return (
    <TodoEditingProvider
      onTodoUpdated={handleTodoUpdated}
      todoStates={todoStates}
    >
      <View
        testID="weekScreen"
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.header}>
          <View style={styles.weekNavigation}>
            <IconButton
              icon="chevron-left"
              onPress={goToPreviousWeek}
              testID="weekPrevWeek"
            />
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={styles.dateButton}
              testID="weekDateButton"
            >
              <Text
                testID="weekDateHeader"
                variant="titleMedium"
                style={styles.dateText}
              >
                {weekData
                  ? formatWeekRange(weekData.startDate, weekData.endDate)
                  : ""}
              </Text>
            </TouchableOpacity>
            <IconButton
              icon="chevron-right"
              onPress={goToNextWeek}
              testID="weekNextWeek"
            />
            <IconButton
              icon={showCompleted ? "check-circle" : "check-circle-outline"}
              onPress={() => setShowCompleted(!showCompleted)}
              testID="weekShowCompletedToggle"
            />
            <IconButton
              icon="refresh"
              onPress={onRefresh}
              disabled={refreshing}
              testID="weekRefreshButton"
            />
          </View>
          <View style={styles.chipRow}>
            {!isCurrentWeek && (
              <Chip
                mode="outlined"
                onPress={goToCurrentWeek}
                style={styles.chip}
                testID="weekCurrentWeekChip"
              >
                Current Week
              </Chip>
            )}
            {isCurrentWeek && (
              <Chip
                mode="outlined"
                onPress={scrollToToday}
                style={styles.chip}
                testID="weekTodayChip"
              >
                Jump to Today
              </Chip>
            )}
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            testID="weekDatePicker"
            value={weekStartDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onDateChange}
          />
        )}

        <FilterBar testID="weekFilterBar" />

        {sections.length === 0 ? (
          <View testID="weekEmptyView" style={styles.centered}>
            <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
              No items this week
            </Text>
          </View>
        ) : (
          <SectionList
            ref={sectionListRef}
            testID="weekList"
            sections={sections}
            keyExtractor={(item) => getTodoKey(item)}
            renderItem={({ item }) => {
              const completed = isCompleted(item);
              return <TodoItem todo={item} opacity={completed ? 0.6 : 1} />;
            }}
            renderSectionHeader={({ section }) => (
              <View
                style={[
                  styles.sectionHeader,
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
                  {section.data.length} item{section.data.length !== 1 && "s"}
                </Text>
              </View>
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            stickySectionHeadersEnabled={true}
            onScrollToIndexFailed={() => {
              // Handle scroll failure gracefully
            }}
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
  weekNavigation: {
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
  chipRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: 4,
  },
  chip: {
    marginHorizontal: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
