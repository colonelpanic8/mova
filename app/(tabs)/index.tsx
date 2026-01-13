import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import { api, AgendaResponse, AgendaEntry } from '@/services/api';

export default function AgendaScreen() {
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  const fetchAgenda = useCallback(async () => {
    if (!apiUrl || !username || !password) return;

    try {
      api.configure(apiUrl, username, password);
      const data = await api.getAgenda('day');
      setAgenda(data);
      setError(null);
    } catch (err) {
      setError('Failed to load agenda');
      console.error(err);
    }
  }, [apiUrl, username, password]);

  useEffect(() => {
    fetchAgenda().finally(() => setLoading(false));
  }, [fetchAgenda]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAgenda();
    setRefreshing(false);
  }, [fetchAgenda]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="titleLarge">{agenda?.date}</Text>
      </View>

      {agenda?.entries.length === 0 ? (
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
            No items for today
          </Text>
        </View>
      ) : (
        <FlatList
          data={agenda?.entries}
          keyExtractor={(item, index) => item.id || `${index}-${item.pos}`}
          renderItem={({ item }) => (
            <View style={[styles.entry, { borderBottomColor: theme.colors.outlineVariant }]}>
              <View style={styles.entryHeader}>
                {item.todo && (
                  <Text style={[styles.todoState, { color: item.todo === 'DONE' ? theme.colors.outline : theme.colors.primary }]}>
                    {item.todo}
                  </Text>
                )}
                <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              {item.tags && item.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {item.tags.map((tag: string) => (
                    <Text key={tag} style={[styles.tag, { backgroundColor: theme.colors.secondaryContainer, color: theme.colors.onSecondaryContainer }]}>
                      {tag}
                    </Text>
                  ))}
                </View>
              )}
              {(item.scheduled || item.deadline) && (
                <View style={styles.timestamps}>
                  {item.scheduled && (
                    <Text style={[styles.timestamp, { color: theme.colors.outline }]}>
                      Scheduled: {new Date(item.scheduled).toLocaleString()}
                    </Text>
                  )}
                  {item.deadline && (
                    <Text style={[styles.timestamp, { color: theme.colors.error }]}>
                      Deadline: {new Date(item.deadline).toLocaleString()}
                    </Text>
                  )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  entry: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  todoState: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  title: {
    flex: 1,
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  tag: {
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timestamps: {
    marginTop: 6,
  },
  timestamp: {
    fontSize: 12,
  },
});
