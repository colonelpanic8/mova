import { FilterBar } from "@/components/FilterBar";
import { getTodoKey, TodoItem } from "@/components/TodoItem";
import { useApi } from "@/context/ApiContext";
import { useFilters } from "@/context/FilterContext";
import { useMutation } from "@/context/MutationContext";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import { Todo, TodoStatesResponse } from "@/services/api";
import { filterTodos } from "@/utils/filterTodos";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

export default function SearchScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);

  const api = useApi();
  const theme = useTheme();
  const { mutationVersion } = useMutation();
  const { filters } = useFilters();
  const isInitialMount = useRef(true);

  const handleTodoUpdated = useCallback(
    (todo: Todo, updates: Partial<Todo>) => {
      const key = getTodoKey(todo);
      setTodos((prev) =>
        prev.map((t) => (getTodoKey(t) === key ? { ...t, ...updates } : t)),
      );
    },
    [],
  );

  const fetchTodos = useCallback(async () => {
    if (!api) return;

    try {
      const [todosResponse, statesResponse] = await Promise.all([
        api.getAllTodos(),
        api.getTodoStates().catch(() => null),
      ]);
      setTodos(todosResponse.todos);
      setFilteredTodos(todosResponse.todos);
      if (statesResponse) {
        setTodoStates(statesResponse);
      }
      setError(null);
    } catch (err) {
      setError("Failed to load todos");
      console.error(err);
    }
  }, [api]);

  useEffect(() => {
    fetchTodos().finally(() => setLoading(false));
  }, [fetchTodos]);

  // Refetch when mutations happen elsewhere
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutationVersion]);

  useEffect(() => {
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

    setFilteredTodos(result);
  }, [searchQuery, todos, filters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTodos();
    setRefreshing(false);
  }, [fetchTodos]);

  if (loading) {
    return (
      <View
        testID="searchLoadingView"
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator testID="searchLoadingIndicator" size="large" />
      </View>
    );
  }

  return (
    <TodoEditingProvider
      onTodoUpdated={handleTodoUpdated}
      todoStates={todoStates}
    >
      <View
        testID="searchScreen"
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
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

        {error ? (
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
            testID="searchTodoList"
            data={filteredTodos}
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
});
