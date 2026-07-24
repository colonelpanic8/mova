import { HabitItem } from "@/components/HabitItem";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import {
  buildServerIdentity,
  queryKeys,
  SIGNED_OUT_IDENTITY,
} from "@/hooks/queryKeys";
import { useHabitConfig } from "@/hooks/useHabitConfig";
import { useHabitStatuses } from "@/hooks/useServerData";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import { HabitStatus, Todo } from "@/services/api";
import { computeHabitGraphWindow } from "@/utils/habitGraphLayout";
import { isHabitTodo } from "@/utils/habits";
import { getTodoKey } from "@/utils/todoKey";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
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

const INITIAL_LOAD_RETRY_DELAY_MS = 750;

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
        <View
          style={[
            styles.statDivider,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />
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
        <View
          style={[
            styles.statDivider,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />
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
  const { apiUrl, username } = useAuth();
  const {
    config,
    isLoading: configLoading,
    refetch: refetchConfig,
    ensureFresh: ensureFreshConfig,
  } = useHabitConfig();
  const { width: screenWidth } = useWindowDimensions();

  // Calculate preceding/following based on screen width (same logic as HabitItem)
  const { preceding, following } = useMemo(
    () => computeHabitGraphWindow(screenWidth),
    [screenWidth],
  );

  const identity = buildServerIdentity(apiUrl, username);
  const habitsEnabled = config?.enabled !== false;
  const todosQuery = useQuery({
    queryKey: queryKeys.todos(identity ?? SIGNED_OUT_IDENTITY),
    enabled: Boolean(api && identity && habitsEnabled),
    queryFn: () => api!.getAllTodos(),
    // A failure right at startup is often transient (server still warming
    // up); retry once after a short delay before surfacing an error.
    retry: 1,
    retryDelay: INITIAL_LOAD_RETRY_DELAY_MS,
  });
  const { refetch: refetchTodos } = todosQuery;
  const statusesQuery = useHabitStatuses(preceding, following, {
    enabled: habitsEnabled,
  });
  const { refetch: refetchStatuses } = statusesQuery;

  const habits = useMemo(
    () => (todosQuery.data?.todos ?? []).filter(isHabitTodo),
    [todosQuery.data?.todos],
  );
  const habitStatusMap = useMemo(() => {
    const statusMap = new Map<string, HabitStatus>();
    for (const status of statusesQuery.data ?? []) {
      if (status.id) {
        statusMap.set(status.id, status);
      }
    }
    return statusMap;
  }, [statusesQuery.data]);

  const isLoading = todosQuery.isFetching;
  const error = todosQuery.isError ? "Failed to load habits" : null;

  const refreshHabits = useCallback(async () => {
    await Promise.all([refetchTodos(), refetchStatuses()]);
  }, [refetchTodos, refetchStatuses]);

  useFocusEffect(
    useCallback(() => {
      if (config?.enabled === false) {
        return;
      }

      void ensureFreshConfig().finally(() => {
        // Revalidate on focus (parity with the previous hand-rolled loader);
        // cancelRefetch: false keeps an in-flight initial fetch undisturbed.
        void refetchTodos({ cancelRefetch: false });
        void refetchStatuses({ cancelRefetch: false });
      });
    }, [config?.enabled, ensureFreshConfig, refetchTodos, refetchStatuses]),
  );

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
        onRefreshNeeded={refreshHabits}
      />
    ),
    [habitStatusMap, refreshHabits],
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

  if (isLoading && habits.length === 0) {
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

  if (error && habits.length === 0) {
    return (
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={styles.errorState}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refreshHabits} />
          }
        >
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.error, marginBottom: 8 }}
          >
            {error}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}
          >
            Pull to refresh or tap retry.
          </Text>
          <Button
            mode="outlined"
            onPress={refreshHabits}
            loading={isLoading}
            icon="refresh"
          >
            Retry
          </Button>
        </ScrollView>
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
            <RefreshControl refreshing={isLoading} onRefresh={refreshHabits} />
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
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorState: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});
