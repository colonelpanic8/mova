import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import { api, AgendaResponse } from '@/services/api';

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
          keyExtractor={(item, index) => `${index}-${item}`}
          renderItem={({ item }) => (
            <View style={[styles.entry, { borderBottomColor: theme.colors.outlineVariant }]}>
              <Text style={[styles.entryText, { color: theme.colors.onSurface }]}>
                {item}
              </Text>
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
  entryText: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
});
