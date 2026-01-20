import { TodoItem } from "@/components/TodoItem";
import { useAuth } from "@/context/AuthContext";
import { useHabitConfig } from "@/context/HabitConfigContext";
import { useMutation } from "@/context/MutationContext";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import { api, Todo } from "@/services/api";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";

interface HabitStats {
  remainingToday: number;
  totalHabits: number;
  onTrack: number;
}

function HabitStatsCard({ stats }: { stats: HabitStats }) {
  const theme = useTheme();

  return (
    <Card style={styles.statsCard}>
      <Card.Content style={styles.statsContent}>
        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
            {stats.remainingToday}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            remaining today
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={{ color: theme.colors.tertiary }}>
            {stats.onTrack}/{stats.totalHabits}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            on track
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

export default function HabitsScreen() {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const { config } = useHabitConfig();
  const { mutationVersion } = useMutation();
  const [habits, setHabits] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHabits = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getAllTodos();
      const habitTodos = response.todos.filter((todo) => todo.isWindowHabit);
      setHabits(habitTodos);
    } catch (err) {
      console.error("Failed to load habits:", err);
      setError("Failed to load habits");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadHabits();
  }, [loadHabits, mutationVersion]);

  const stats = useMemo((): HabitStats => {
    const remainingToday = habits.filter(
      (h) => h.habitSummary?.completionNeededToday && h.todo !== "DONE"
    ).length;
    const onTrack = habits.filter(
      (h) => (h.habitSummary?.conformingRatio ?? 0) >= 1.0
    ).length;
    return {
      remainingToday,
      totalHabits: habits.length,
      onTrack,
    };
  }, [habits]);

  const renderItem = useCallback(
    ({ item }: { item: Todo }) => <TodoItem todo={item} />,
    []
  );

  const keyExtractor = useCallback(
    (item: Todo) => item.id || `${item.file}:${item.pos}`,
    []
  );

  if (!config?.enabled) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            Habits are not enabled on your server.
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Enable org-window-habit-mode in Emacs to use this feature.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <TodoEditingProvider>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <FlatList
          data={habits}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={<HabitStatsCard stats={stats} />}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                  No habits found
                </Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadHabits} />
          }
          contentContainerStyle={styles.listContent}
        />
      </View>
    </TodoEditingProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  statsCard: {
    margin: 16,
  },
  statsContent: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#ccc",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});
