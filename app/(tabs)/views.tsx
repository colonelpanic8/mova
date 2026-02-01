import { FilterBar } from "@/components/FilterBar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { getTodoKey, TodoItem } from "@/components/TodoItem";
import { useApi } from "@/context/ApiContext";
import { useFilters } from "@/context/FilterContext";
import { useMutation } from "@/context/MutationContext";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import {
  CustomView,
  CustomViewResponse,
  Todo,
  TodoStatesResponse,
} from "@/services/api";
import { filterTodos } from "@/utils/filterTodos";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [views, setViews] = useState<CustomView[]>([]);
  const [selectedView, setSelectedView] = useState<CustomViewResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);
  const api = useApi();
  const theme = useTheme();
  const { mutationVersion } = useMutation();
  const { filters } = useFilters();
  const isInitialMount = useRef(true);

  // Apply filters to view entries
  const filteredEntries = selectedView
    ? filterTodos(selectedView.entries, filters)
    : [];

  const handleTodoUpdated = useCallback(
    (todo: Todo, updates: Partial<Todo>) => {
      setSelectedView((prev) => {
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
    [],
  );

  const fetchViews = useCallback(async () => {
    if (!api) return;

    try {
      const [viewsData, statesData] = await Promise.all([
        api.getCustomViews(),
        api.getTodoStates().catch(() => null),
      ]);
      setViews(viewsData.views);
      if (statesData) {
        setTodoStates(statesData);
      }
      setError(null);
    } catch (err) {
      setError("Failed to load views");
      console.error(err);
    }
  }, [api]);

  const fetchViewEntries = useCallback(
    async (key: string) => {
      if (!api) return;

      setLoading(true);
      try {
        const viewData = await api.getCustomView(key);
        setSelectedView(viewData);
        setError(null);
      } catch (err) {
        setError("Failed to load view entries");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    fetchViews().finally(() => setLoading(false));
  }, [fetchViews]);

  // Refetch when mutations happen elsewhere
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (selectedView) {
      fetchViewEntries(selectedView.key);
    } else {
      fetchViews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutationVersion]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedView) {
      await fetchViewEntries(selectedView.key);
    } else {
      await fetchViews();
    }
    setRefreshing(false);
  }, [fetchViews, fetchViewEntries, selectedView]);

  const handleViewPress = useCallback(
    (view: CustomView) => {
      fetchViewEntries(view.key);
    },
    [fetchViewEntries],
  );

  const handleBack = useCallback(() => {
    setSelectedView(null);
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
