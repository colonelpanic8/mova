import { HabitItem } from "@/components/HabitItem";
import { ScreenContainer } from "@/components/ScreenContainer";
import { getTodoKey } from "@/components/TodoItem";
import { useApi } from "@/context/ApiContext";
import { useHabitConfig } from "@/context/HabitConfigContext";
import { useMutation } from "@/context/MutationContext";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import { HabitStatus, Todo } from "@/services/api";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Text,
  useTheme,
} from "react-native-paper";

// Layout constants (must match HabitItem)
const CELL_WIDTH = 24;
const TODAY_CELL_EXTRA = 4;
const CELL_GAP = 3;
const GRAPH_OUTER_PADDING = 6;
const ITEM_CONTAINER_PADDING = 12;

interface HabitStats {
  remainingToday: number;
  totalHabits: number;
  onTrack: number;
  averageConforming: number;
}

function HabitStatsCard({ stats }: { stats: HabitStats }) {
  const theme = useTheme();

  return (
    <Card style={styles.statsCard}>
      <Card.Content style={styles.statsContent}>
        <View style={styles.statItem}>
          <Text
            variant="headlineMedium"
            style={{ color: theme.colors.primary }}
          >
            {stats.remainingToday}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            remaining today
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text
            variant="headlineMedium"
            style={{ color: theme.colors.tertiary }}
          >
            {stats.onTrack}/{stats.totalHabits}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            on track
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text
            variant="headlineMedium"
            style={{ color: theme.colors.secondary }}
          >
            {(stats.averageConforming * 100).toFixed(0)}%
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            avg conforming
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

export default function HabitsScreen() {
  const theme = useTheme();
  const api = useApi();
  const {
    config,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = useHabitConfig();
  const { mutationVersion } = useMutation();
  const { width: screenWidth } = useWindowDimensions();
  const [habits, setHabits] = useState<Todo[]>([]);
  const [habitStatusMap, setHabitStatusMap] = useState<
    Map<string, HabitStatus>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  // Calculate preceding/following based on screen width (same logic as HabitItem)
  const { preceding, following } = useMemo(() => {
    const availableWidth =
      screenWidth - ITEM_CONTAINER_PADDING * 2 - GRAPH_OUTER_PADDING * 2;
    const maxCells = Math.floor(
      (availableWidth + CELL_GAP - TODAY_CELL_EXTRA) / (CELL_WIDTH + CELL_GAP),
    );
    const pastCells = Math.ceil(maxCells / 2);
    const futureCells = Math.floor(maxCells / 2);
    const preceding = Math.min(14, Math.max(1, pastCells - 1));
    const following = Math.min(14, Math.max(1, futureCells));
    return { preceding, following };
  }, [screenWidth]);

  const loadHabits = useCallback(async () => {
    if (!api) return;

    setIsLoading(true);
    setError(null);
    try {
      // Fetch todos and statuses in parallel, but don't let a status failure
      // blank the entire habits list.
      const [todosResponse, habitStatusesResponse] = await Promise.all([
        api.getAllTodos(),
        api.getAllHabitStatuses(preceding, following).catch((err) => {
          console.warn("Failed to load habit statuses:", err);
          return null;
        }),
      ]);

      const habitTodos = todosResponse.todos.filter(
        (todo) => todo.isWindowHabit || todo.properties?.STYLE === "habit",
      );
      setHabits(habitTodos);

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
    } catch (err) {
      console.error("Failed to load habits:", err);
      setError("Failed to load habits");
    } finally {
      setIsLoading(false);
    }
  }, [api, preceding, following]);

  useEffect(() => {
    loadHabits();
  }, [loadHabits, mutationVersion, config?.enabled]);

  const stats = useMemo((): HabitStats => {
    const remainingToday = habits.filter(
      (h) => h.habitSummary?.completionNeededToday && h.todo !== "DONE",
    ).length;
    const onTrack = habits.filter(
      (h) => (h.habitSummary?.conformingRatio ?? 0) >= 1.0,
    ).length;
    const conformingRatios = habits
      .map((h) => h.habitSummary?.conformingRatio)
      .filter((r): r is number => r !== undefined);
    const averageConforming =
      conformingRatios.length > 0
        ? conformingRatios.reduce((sum, r) => sum + r, 0) /
          conformingRatios.length
        : 0;
    return {
      remainingToday,
      totalHabits: habits.length,
      onTrack,
      averageConforming,
    };
  }, [habits]);

  const renderItem = useCallback(
    ({ item }: { item: Todo }) => (
      <HabitItem
        todo={item}
        habitStatus={item.id ? habitStatusMap.get(item.id) : undefined}
        onRefreshNeeded={loadHabits}
      />
    ),
    [habitStatusMap, loadHabits],
  );

  const keyExtractor = useCallback((item: Todo) => getTodoKey(item), []);

  if (configLoading) {
    return (
      <ScreenContainer>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!config) {
    return (
      <ScreenContainer>
        <View style={styles.emptyState}>
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Habits configuration is unavailable.
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}
          >
            This is often transient during startup. Pull to refresh or tap
            below.
          </Text>
          <Button mode="outlined" onPress={refetchConfig} icon="refresh">
            Refresh Configuration
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  if (!config?.enabled) {
    return (
      <ScreenContainer>
        <View style={styles.emptyState}>
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Habits are not enabled on your server.
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}
          >
            Enable org-window-habit-mode in Emacs to use this feature.
          </Text>
          <Button mode="outlined" onPress={refetchConfig} icon="refresh">
            Refresh Configuration
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <TodoEditingProvider>
      <ScreenContainer>
        <FlatList
          data={habits}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={<HabitStatsCard stats={stats} />}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
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
      </ScreenContainer>
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
