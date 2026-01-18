import { TodoItem, getTodoKey } from "@/components/TodoItem";
import { useAuth } from "@/context/AuthContext";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import { AgendaResponse, Todo, TodoStatesResponse, api } from "@/services/api";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ActivityIndicator,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

function formatDateForApi(date: Date): string {
  // Use local time instead of UTC to avoid off-by-one errors
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AgendaScreen() {
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);
  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  const handleTodoUpdated = useCallback(
    (todo: Todo, updates: Partial<Todo>) => {
      setAgenda((prev) => {
        if (!prev) return prev;

        // If schedule changed, check if item should be removed from current view
        if (updates.scheduled !== undefined) {
          const currentDateStr = formatDateForApi(selectedDate);
          const newScheduledDate = updates.scheduled?.split("T")[0];

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
    },
    [selectedDate],
  );

  const fetchAgenda = useCallback(
    async (date: Date) => {
      console.log("[AgendaScreen] fetchAgenda called", {
        hasApiUrl: !!apiUrl,
        hasUsername: !!username,
        hasPassword: !!password,
        apiUrl: apiUrl ? `${apiUrl.substring(0, 30)}...` : null,
      });

      if (!apiUrl || !username || !password) {
        console.log("[AgendaScreen] Missing credentials, returning early");
        return;
      }

      try {
        console.log("[AgendaScreen] Configuring API and fetching...");
        api.configure(apiUrl, username, password);
        const dateString = formatDateForApi(date);
        const todayString = formatDateForApi(new Date());
        const includeOverdue = dateString <= todayString;
        const [agendaData, statesData] = await Promise.all([
          api.getAgenda("day", dateString, includeOverdue),
          api.getTodoStates().catch(() => null),
        ]);
        console.log("[AgendaScreen] Fetch successful", {
          entriesCount: agendaData?.entries?.length,
        });
        setAgenda(agendaData);
        if (statesData) {
          setTodoStates(statesData);
        }
        setError(null);
      } catch (err) {
        console.error("[AgendaScreen] Fetch failed:", err);
        console.error("[AgendaScreen] Error details:", {
          name: err instanceof Error ? err.name : "unknown",
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        setError("Failed to load agenda");
      }
    },
    [apiUrl, username, password],
  );

  useEffect(() => {
    fetchAgenda(selectedDate).finally(() => setLoading(false));
  }, [fetchAgenda, selectedDate]);

  const goToPreviousDay = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const goToNextDay = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

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
    await fetchAgenda(selectedDate);
    setRefreshing(false);
  }, [fetchAgenda, selectedDate]);

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
          style={{ color: theme.colors.error }}
        >
          {error}
        </Text>
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
              onPress={goToPreviousDay}
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
                {agenda?.date ? formatDateForDisplay(agenda.date) : ""}
              </Text>
            </TouchableOpacity>
            <IconButton
              icon="chevron-right"
              onPress={goToNextDay}
              testID="agendaNextDay"
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

        {agenda?.entries.length === 0 ? (
          <View testID="agendaEmptyView" style={styles.centered}>
            <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
              No items for today
            </Text>
          </View>
        ) : (
          <FlatList
            testID="agendaList"
            data={agenda?.entries}
            keyExtractor={(item) => getTodoKey(item)}
            renderItem={({ item }) => <TodoItem todo={item} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
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
});
