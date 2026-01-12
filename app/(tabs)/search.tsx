import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Searchbar, Text, useTheme, ActivityIndicator, Chip } from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import { api, Todo } from '@/services/api';

export default function SearchScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  const fetchTodos = useCallback(async () => {
    if (!apiUrl || !username || !password) return;

    try {
      api.configure(apiUrl, username, password);
      const data = await api.getAllTodos();
      setTodos(data);
      setFilteredTodos(data);
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
          keyExtractor={(item, index) => `${index}-${item.title}`}
          renderItem={({ item }) => (
            <View style={[styles.todoItem, { borderBottomColor: theme.colors.outlineVariant }]}>
              <View style={styles.todoHeader}>
                {item.todo && (
                  <Chip
                    mode="flat"
                    compact
                    style={[
                      styles.todoChip,
                      { backgroundColor: getTodoColor(item.todo, theme) }
                    ]}
                    textStyle={{ fontSize: 10, color: 'white' }}
                  >
                    {item.todo}
                  </Chip>
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
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
