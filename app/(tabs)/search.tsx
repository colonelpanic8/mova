import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Searchbar, Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import { api, Todo, TodoStatesResponse } from '@/services/api';
import { TodoItem, getTodoKey } from '@/components/TodoItem';
import { useTodoEditing } from '@/hooks/useTodoEditing';

export default function SearchScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);

  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  const handleTodoUpdated = useCallback((todo: Todo, updates: Partial<Todo>) => {
    const key = getTodoKey(todo);
    setTodos(prev => prev.map(t =>
      getTodoKey(t) === key ? { ...t, ...updates } : t
    ));
  }, []);

  const {
    completingIds,
    updatingIds,
    swipeableRefs,
    handleTodoPress,
    scheduleTomorrow,
    openScheduleModal,
    openDeadlineModal,
    openPriorityModal,
    EditModals,
  } = useTodoEditing({
    onTodoUpdated: handleTodoUpdated,
    todoStates,
  });

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
      setError('Failed to load todos');
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
    const filtered = todos.filter(todo => {
      const titleMatch = todo.title?.toLowerCase().includes(query);
      const tagMatch = todo.tags?.some(tag => tag.toLowerCase().includes(query));
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
      <View testID="searchLoadingView" style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator testID="searchLoadingIndicator" size="large" />
      </View>
    );
  }

  return (
    <View testID="searchScreen" style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
          <Text testID="searchErrorText" variant="bodyLarge" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        </View>
      ) : filteredTodos.length === 0 ? (
        <View testID="searchEmptyView" style={styles.centered}>
          <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
            {searchQuery ? 'No matching todos' : 'No todos found'}
          </Text>
        </View>
      ) : (
        <FlatList
          testID="searchTodoList"
          data={filteredTodos}
          keyExtractor={(item) => getTodoKey(item)}
          renderItem={({ item }) => {
            const key = getTodoKey(item);
            return (
              <TodoItem
                ref={(ref) => {
                  if (ref) swipeableRefs.current.set(key, ref);
                }}
                todo={item}
                isCompleting={completingIds.has(key)}
                isUpdating={updatingIds.has(key)}
                onTodoPress={handleTodoPress}
                onTomorrowPress={scheduleTomorrow}
                onSchedulePress={openScheduleModal}
                onDeadlinePress={openDeadlineModal}
                onPriorityPress={openPriorityModal}
              />
            );
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <EditModals />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
  },
  searchbar: {
    elevation: 0,
  },
});
