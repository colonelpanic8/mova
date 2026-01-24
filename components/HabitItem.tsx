import { HabitGraph } from "@/components/HabitGraph";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { useTodoEditingContext } from "@/hooks/useTodoEditing";
import {
  HabitStatusGraphEntry,
  MiniGraphEntry,
  Todo,
  api,
} from "@/services/api";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";

function transformGraphData(graph: HabitStatusGraphEntry[]): MiniGraphEntry[] {
  return graph.map((entry) => ({
    date: entry.date,
    conformingRatio: entry.conformingRatioWithout,
    completed: entry.completionCount > 0,
    ...(entry.status === "present" && {
      completionNeededToday: entry.completionExpectedToday,
    }),
  }));
}

function formatNextRequired(dateString: string | undefined): string {
  if (!dateString) return "";

  const date = new Date(dateString + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface HabitItemProps {
  todo: Todo;
}

export function HabitItem({ todo }: HabitItemProps) {
  const theme = useTheme();
  const router = useRouter();
  const { quickComplete, completingIds } = useTodoEditingContext();
  const { defaultDoneState } = useSettings();
  const { todoStates } = useTemplates();
  const { apiUrl, username, password } = useAuth();

  const [menuVisible, setMenuVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [graphData, setGraphData] = useState<MiniGraphEntry[] | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  // Fetch habit status for graph data
  useEffect(() => {
    if (!todo.id || !apiUrl || !username || !password) return;

    setGraphLoading(true);
    api.configure(apiUrl, username, password);
    api
      .getHabitStatus(todo.id, 14, 1)
      .then((status) => {
        if (status.graph) {
          setGraphData(transformGraphData(status.graph));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch habit status:", err);
      })
      .finally(() => {
        setGraphLoading(false);
      });
  }, [todo.id, apiUrl, username, password]);

  // Compute effective default done state
  const effectiveDoneState = useMemo(() => {
    if (defaultDoneState) return defaultDoneState;
    if (!todoStates?.done?.length) return "DONE";
    return todoStates.done.includes("DONE") ? "DONE" : todoStates.done[0];
  }, [defaultDoneState, todoStates]);

  const key = todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
  const isCompleting = completingIds.has(key);

  const habitSummary = todo.habitSummary;
  const needsCompletion = habitSummary?.completionNeededToday;
  const nextRequired = formatNextRequired(habitSummary?.nextRequiredInterval);

  const handleCompleteForDate = useCallback(
    (date: Date) => {
      setMenuVisible(false);
      quickComplete(todo, effectiveDoneState, date);
    },
    [todo, effectiveDoneState, quickComplete],
  );

  const handleCompleteToday = useCallback(() => {
    handleCompleteForDate(new Date());
  }, [handleCompleteForDate]);

  const handleCompleteYesterday = useCallback(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    handleCompleteForDate(yesterday);
  }, [handleCompleteForDate]);

  const handleOpenDatePicker = useCallback(() => {
    setMenuVisible(false);
    setShowDatePicker(true);
  }, []);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(false);
      if (event.type === "dismissed" || !date) {
        return;
      }
      handleCompleteForDate(date);
    },
    [handleCompleteForDate],
  );

  const handlePress = useCallback(() => {
    router.push({
      pathname: "/edit",
      params: {
        todo: JSON.stringify(todo),
      },
    });
  }, [router, todo]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed
            ? theme.colors.surfaceVariant
            : theme.colors.surface,
          borderBottomColor: theme.colors.outlineVariant,
        },
      ]}
    >
      {/* Header row: Title and completion button */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text variant="titleMedium" style={styles.title} numberOfLines={2}>
            {todo.title}
          </Text>
          {nextRequired && !needsCompletion && (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
            >
              {nextRequired}
            </Text>
          )}
        </View>

        {needsCompletion && (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button
                mode="contained"
                compact
                onPress={() => setMenuVisible(true)}
                disabled={isCompleting}
                loading={isCompleting}
                icon="check"
                style={styles.completeButton}
              >
                Complete
              </Button>
            }
            anchorPosition="bottom"
          >
            <Menu.Item
              onPress={handleCompleteToday}
              title="Today"
              leadingIcon="calendar-today"
            />
            <Menu.Item
              onPress={handleCompleteYesterday}
              title="Yesterday"
              leadingIcon="calendar-arrow-left"
            />
            <Divider />
            <Menu.Item
              onPress={handleOpenDatePicker}
              title="Choose date..."
              leadingIcon="calendar"
            />
          </Menu>
        )}

        {!needsCompletion && (
          <View
            style={[
              styles.completedBadge,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onPrimaryContainer }}
            >
              Done
            </Text>
          </View>
        )}
      </View>

      {/* Habit Graph */}
      <View style={styles.graphContainer}>
        {graphLoading && (
          <ActivityIndicator size="small" style={styles.graphSpinner} />
        )}
        {!graphLoading && graphData && <HabitGraph miniGraph={graphData} />}
      </View>

      {/* Date picker modal */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontWeight: "500",
  },
  completeButton: {
    minWidth: 100,
  },
  completedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  graphContainer: {
    marginTop: 8,
    minHeight: 20,
  },
  graphSpinner: {
    alignSelf: "flex-start",
  },
});

export default HabitItem;
