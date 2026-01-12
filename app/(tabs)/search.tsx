import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Searchbar, Text, useTheme, ActivityIndicator, Chip, Snackbar } from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import { api, Todo } from '@/services/api';

export default function SearchScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; isError: boolean }>({
    visible: false,
    message: '',
    isError: false,
  });
  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  const fetchTodos = useCallback(async () => {
    if (!apiUrl || !username || !password) return;

    try {
      api.configure(apiUrl, username, password);
      const response = await api.getAllTodos();
      setTodos(response.todos);
      setFilteredTodos(response.todos);
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

  const getTodoKey = (todo: Todo): string => {
    return todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
  };

  const handleTodoPress = async (todo: Todo) => {
    const key = getTodoKey(todo);

    // Don't allow completing if already in progress
    if (completingIds.has(key)) return;

    // Don't complete already done items
    if (todo.todo?.toUpperCase() === 'DONE') {
      setSnackbar({ visible: true, message: 'Already completed', isError: false });
      return;
    }

    setCompletingIds(prev => new Set(prev).add(key));

    try {
      const result = await api.completeTodo(todo);

      if (result.status === 'completed') {
        setSnackbar({
          visible: true,
          message: `Completed: ${todo.title}`,
          isError: false
        });
        // Update local state to reflect completion
        setTodos(prev => prev.map(t =>
          getTodoKey(t) === key ? { ...t, todo: result.newState || 'DONE' } : t
        ));
      } else {
        setSnackbar({
          visible: true,
          message: result.message || 'Failed to complete',
          isError: true
        });
      }
    } catch (err) {
      console.error('Failed to complete todo:', err);
      setSnackbar({ visible: true, message: 'Failed to complete todo', isError: true });
    } finally {
      setCompletingIds(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search todos..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        </View>
      ) : filteredTodos.length === 0 ? (
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
            {searchQuery ? 'No matching todos' : 'No todos found'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTodos}
          keyExtractor={(item) => getTodoKey(item)}
          renderItem={({ item }) => {
            const key = getTodoKey(item);
            const isCompleting = completingIds.has(key);

            return (
              <View style={[styles.todoItem, { borderBottomColor: theme.colors.outlineVariant }]}>
                <View style={styles.todoHeader}>
                  {item.todo && (
                    <TouchableOpacity
                      onPress={() => handleTodoPress(item)}
                      disabled={isCompleting}
                      activeOpacity={0.7}
                    >
                      <Chip
                        mode="flat"
                        compact
                        style={[
                          styles.todoChip,
                          { backgroundColor: getTodoColor(item.todo, theme) },
                          isCompleting && styles.todoChipLoading,
                        ]}
                        textStyle={{ fontSize: 10, color: 'white' }}
                      >
                        {isCompleting ? '...' : item.todo}
                      </Chip>
                    </TouchableOpacity>
                  )}
                  <Text variant="bodyMedium" style={styles.todoTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
                {item.tags && item.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {item.tags.map((tag, i) => (
                      <Text key={i} style={[styles.tag, { color: theme.colors.primary }]}>
                        :{tag}:
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar(prev => ({ ...prev, visible: false }))}
        duration={2000}
        style={snackbar.isError ? { backgroundColor: theme.colors.error } : undefined}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}

function getTodoColor(todo: string, theme: any): string {
  switch (todo.toUpperCase()) {
    case 'TODO':
      return theme.colors.error;
    case 'NEXT':
      return theme.colors.primary;
    case 'DONE':
      return theme.colors.outline;
    case 'WAITING':
      return theme.colors.tertiary;
    default:
      return theme.colors.secondary;
  }
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
  todoItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  todoChip: {
    height: 20,
  },
  todoChipLoading: {
    opacity: 0.6,
  },
  todoTitle: {
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  tag: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
