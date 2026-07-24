import { FilterBar } from "@/components/FilterBar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TodoItem } from "@/components/TodoItem";
import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { useFilters } from "@/context/FilterContext";
import {
  buildServerIdentity,
  queryKeys,
  SIGNED_OUT_IDENTITY,
} from "@/hooks/queryKeys";
import { useTodoStates } from "@/hooks/useServerData";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import { CustomView, CustomViewResponse, Todo } from "@/services/api";
import { filterTodos } from "@/utils/filterTodos";
import { getTodoKey } from "@/utils/todoKey";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
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

export default function ViewsScreen() {
  const [selectedViewKey, setSelectedViewKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const api = useApi();
  const { apiUrl, username } = useAuth();
  const theme = useTheme();
  const { filters } = useFilters();
  const queryClient = useQueryClient();

  const identity = buildServerIdentity(apiUrl, username);
  const viewsQuery = useQuery({
    queryKey: queryKeys.views(identity ?? SIGNED_OUT_IDENTITY),
    enabled: Boolean(api && identity),
    queryFn: () => api!.getCustomViews(),
  });
  const { refetch: refetchViews } = viewsQuery;
  const views = viewsQuery.data?.views ?? [];

  const entriesKey = useMemo(
    () =>
      queryKeys.viewEntries(
        identity ?? SIGNED_OUT_IDENTITY,
        selectedViewKey ?? "",
      ),
    [identity, selectedViewKey],
  );
  const entriesQuery = useQuery({
    queryKey: entriesKey,
    enabled: Boolean(api && identity && selectedViewKey),
    queryFn: () => api!.getCustomView(selectedViewKey!),
  });
  const { refetch: refetchEntries } = entriesQuery;
  const selectedView = selectedViewKey ? (entriesQuery.data ?? null) : null;

  const todoStatesQuery = useTodoStates();
  const todoStates = todoStatesQuery.data ?? null;

  const loading = selectedViewKey
    ? entriesQuery.isPending
    : viewsQuery.isPending;
  const error = selectedViewKey
    ? entriesQuery.isError
      ? "Failed to load view entries"
      : null
    : viewsQuery.isError
      ? "Failed to load views"
      : null;

  // Apply filters to view entries
  const filteredEntries = selectedView
    ? filterTodos(selectedView.entries, filters)
    : [];

  const handleTodoUpdated = useCallback(
    (todo: Todo, updates: Partial<Todo>) => {
      queryClient.setQueryData<CustomViewResponse>(entriesKey, (prev) => {
        if (!prev) return prev;
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
    [queryClient, entriesKey],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedViewKey) {
      await refetchEntries();
    } else {
      await refetchViews();
    }
    setRefreshing(false);
  }, [selectedViewKey, refetchEntries, refetchViews]);

  const handleViewPress = useCallback((view: CustomView) => {
    setSelectedViewKey(view.key);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedViewKey(null);
  }, []);

  if (loading) {
    return (
      <ScreenContainer>
        <View testID="viewsLoadingView" style={styles.centered}>
          <ActivityIndicator testID="viewsLoadingIndicator" size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <ScrollView
          testID="viewsErrorView"
          contentContainerStyle={[styles.centered, { flexGrow: 1 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text
            testID="viewsErrorText"
            variant="bodyLarge"
            style={{ color: theme.colors.error }}
          >
            {error}
          </Text>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Show view entries
  if (selectedView) {
    return (
      <TodoEditingProvider
        onTodoUpdated={handleTodoUpdated}
        todoStates={todoStates}
      >
        <ScreenContainer testID="viewEntriesScreen">
          <View
            style={[
              styles.header,
              { borderBottomColor: theme.colors.outlineVariant },
            ]}
          >
            <IconButton
              icon="arrow-left"
              onPress={handleBack}
              testID="viewBackButton"
            />
            <Text variant="titleMedium" style={styles.headerTitle}>
              {selectedView.name}
            </Text>
            <IconButton
              icon="refresh"
              onPress={onRefresh}
              disabled={refreshing}
              testID="viewRefreshButton"
            />
          </View>

          <FilterBar testID="viewFilterBar" />

          {filteredEntries.length === 0 ? (
            <View testID="viewEmptyView" style={styles.centered}>
              <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
                No items in this view
              </Text>
            </View>
          ) : (
            <FlatList
              testID="viewEntriesList"
              data={filteredEntries}
              keyExtractor={(item) => getTodoKey(item)}
              renderItem={({ item }) => <TodoItem todo={item} />}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )}
        </ScreenContainer>
      </TodoEditingProvider>
    );
  }

  // Show view list
  return (
    <ScreenContainer testID="viewsListScreen">
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.colors.outlineVariant },
        ]}
      >
        <View style={{ width: 48 }} />
        <Text variant="titleMedium" style={styles.headerTitle}>
          Views
        </Text>
        <IconButton
          icon="refresh"
          onPress={onRefresh}
          disabled={refreshing}
          testID="viewsRefreshButton"
        />
      </View>
      {views.length === 0 ? (
        <View testID="viewsEmptyView" style={styles.centered}>
          <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
            No custom views configured
          </Text>
        </View>
      ) : (
        <FlatList
          testID="viewsList"
          data={views}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`viewItem-${item.key}`}
              style={[
                styles.viewItem,
                { borderBottomColor: theme.colors.outlineVariant },
              ]}
              onPress={() => handleViewPress(item)}
            >
              <View style={styles.viewItemContent}>
                <Text variant="bodyLarge">{item.name}</Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.outline }}
                >
                  {item.key}
                </Text>
              </View>
              <IconButton icon="chevron-right" size={20} />
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </ScreenContainer>
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 8,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  viewItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  viewItemContent: {
    flex: 1,
  },
});
