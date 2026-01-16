import { getTodoKey, TodoItem } from "@/components/TodoItem";
import { useAuth } from "@/context/AuthContext";
import { TodoEditingProvider } from "@/hooks/useTodoEditing";
import { api, Todo, TodoStatesResponse } from "@/services/api";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
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

  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

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
    if (!apiUrl || !username || !password) return;

    try {
      api.configure(apiUrl, username, password);
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
  }, [apiUrl, username, password]);

  useEffect(() => {
    fetchTodos().finally(() => setLoading(false));
  }, [fetchTodos]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTodos(todos);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = todos.filter((todo) => {
      const titleMatch = todo.title?.toLowerCase().includes(query);
      const tagMatch = todo.tags?.some((tag) =>
        tag.toLowerCase().includes(query),
      );
      const todoMatch = todo.todo?.toLowerCase().includes(query);
      return titleMatch || tagMatch || todoMatch;
    });
    setFilteredTodos(filtered);
  }, [searchQuery, todos]);

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
    <TodoEditingProvider onTodoUpdated={handleTodoUpdated} todoStates={todoStates}>
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
        </View>

        {error ? (
          <View testID="searchErrorView" style={styles.centered}>
            <Text
              testID="searchErrorText"
              variant="bodyLarge"
              style={{ color: theme.colors.error }}
            >
              {error}
            </Text>
          </View>
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
    padding: 16,
  },
  searchbar: {
    elevation: 0,
  },
});
