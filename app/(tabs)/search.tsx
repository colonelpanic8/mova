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
import { GetAllTodosResponse, Todo } from "@/services/api";
import { filterTodos } from "@/utils/filterTodos";
import { getTodoKey } from "@/utils/todoKey";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  IconButton,
  Searchbar,
  Text,
  useTheme,
} from "react-native-paper";

/**
 * Rows mounted per page. The full result set can be thousands of todos;
 * rendering a bounded window keeps a filter change from mounting all of them
 * at once.
 */
const PAGE_SIZE = 40;

const keyExtractor = (item: Todo) => getTodoKey(item);

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();

  useEffect(() => {
    if (params.q === undefined) return;
    setSearchQuery(params.q);
    router.setParams({ q: undefined });
  }, [params.q, router]);

  const api = useApi();
  const { apiUrl, username } = useAuth();
  const theme = useTheme();
  const { filters, filtersReady } = useFilters();
  const queryClient = useQueryClient();

  const identity = buildServerIdentity(apiUrl, username);
  const todosKey = useMemo(
    () => queryKeys.todos(identity ?? SIGNED_OUT_IDENTITY),
    [identity],
  );
  const todosQuery = useQuery({
    queryKey: todosKey,
    enabled: Boolean(api && identity),
    queryFn: () => api!.getAllTodos(),
  });
  const { refetch: refetchTodos } = todosQuery;
  const todos = useMemo(
    () => todosQuery.data?.todos ?? [],
    [todosQuery.data?.todos],
  );
  const todoStatesQuery = useTodoStates();
  const todoStates = todoStatesQuery.data ?? null;
  const { refetch: refetchTodoStates } = todoStatesQuery;

  // Wait for persisted settings before rendering rows: the habit filter
  // defaults to "off" until they load, so rendering earlier shows a list that
  // rearranges itself a beat later.
  const loading = todosQuery.isPending || !filtersReady;
  const error = todosQuery.isError ? "Failed to load todos" : null;

  const handleTodoUpdated = useCallback(
    (todo: Todo, updates: Partial<Todo>) => {
      const key = getTodoKey(todo);
      queryClient.setQueryData<GetAllTodosResponse>(todosKey, (prev) =>
        prev
          ? {
              ...prev,
              todos: prev.todos.map((t) =>
                getTodoKey(t) === key ? { ...t, ...updates } : t,
              ),
            }
          : prev,
      );
    },
    [queryClient, todosKey],
  );

  const filteredTodos = useMemo(() => {
    // First apply context filters
    let result = filterTodos(todos, filters);

    // Then apply text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((todo) => {
        const titleMatch = todo.title?.toLowerCase().includes(query);
        const tagMatch = todo.tags?.some((tag) =>
          tag.toLowerCase().includes(query),
        );
        const todoMatch = todo.todo?.toLowerCase().includes(query);
        return titleMatch || tagMatch || todoMatch;
      });
    }

    return result;
  }, [searchQuery, todos, filters]);

  const listRef = useRef<FlatList<Todo>>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // A changed query or filter is a new result set: restart at the top with a
  // fresh window instead of growing the mounted list.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [searchQuery, filters]);

  const visibleTodos = useMemo(
    () => filteredTodos.slice(0, visibleCount),
    [filteredTodos, visibleCount],
  );

  const handleEndReached = useCallback(() => {
    setVisibleCount((count) =>
      count < filteredTodos.length ? count + PAGE_SIZE : count,
    );
  }, [filteredTodos.length]);

  const renderItem = useCallback(
    ({ item }: { item: Todo }) => <TodoItem todo={item} />,
    [],
  );

  const listFooter = useMemo(() => {
    if (visibleTodos.length >= filteredTodos.length) return null;
    return (
      <View testID="searchListFooter" style={styles.footer}>
        <Text variant="bodySmall" style={{ opacity: 0.6 }}>
          {`Showing ${visibleTodos.length} of ${filteredTodos.length}`}
        </Text>
      </View>
    );
  }, [visibleTodos.length, filteredTodos.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchTodos(), refetchTodoStates()]);
    setRefreshing(false);
  }, [refetchTodos, refetchTodoStates]);

  return (
    <TodoEditingProvider
      onTodoUpdated={handleTodoUpdated}
      todoStates={todoStates}
    >
      <ScreenContainer testID="searchScreen">
        <View style={styles.searchContainer}>
          <Searchbar
            testID="searchInput"
            placeholder="Search todos..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
          />
          <IconButton
            icon="refresh"
            onPress={onRefresh}
            disabled={refreshing}
            testID="searchRefreshButton"
          />
        </View>

        <FilterBar testID="searchFilterBar" />

        {loading ? (
          <View testID="searchLoadingView" style={styles.centered}>
            <ActivityIndicator testID="searchLoadingIndicator" size="large" />
          </View>
        ) : error ? (
          <ScrollView
            testID="searchErrorView"
            contentContainerStyle={[styles.centered, { flexGrow: 1 }]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <Text
              testID="searchErrorText"
              variant="bodyLarge"
              style={{ color: theme.colors.error }}
            >
              {error}
            </Text>
          </ScrollView>
        ) : filteredTodos.length === 0 ? (
          <View testID="searchEmptyView" style={styles.centered}>
            <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
              {searchQuery ? "No matching todos" : "No todos found"}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            testID="searchTodoList"
            data={visibleTodos}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.6}
            ListFooterComponent={listFooter}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingRight: 4,
  },
  searchbar: {
    flex: 1,
    elevation: 0,
  },
  footer: {
    paddingVertical: 12,
    alignItems: "center",
  },
});
