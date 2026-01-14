import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, useTheme, ActivityIndicator, IconButton } from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import { api, CustomView, CustomViewResponse, Todo, TodoStatesResponse } from '@/services/api';
import { TodoItem, getTodoKey } from '@/components/TodoItem';
import { useTodoEditing } from '@/hooks/useTodoEditing';

export default function ViewsScreen() {
  const [views, setViews] = useState<CustomView[]>([]);
  const [selectedView, setSelectedView] = useState<CustomViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);
  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  const handleTodoUpdated = useCallback((todo: Todo, updates: Partial<Todo>) => {
    setSelectedView(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map(entry =>
          getTodoKey(entry) === getTodoKey(todo) ? { ...entry, ...updates } : entry
        ),
      };
    });
  }, []);

  const {
    completingIds,
    updatingIds,
    swipeableRefs,
    handleTodoPress,
    openScheduleModal,
    openDeadlineModal,
    openPriorityModal,
    EditModals,
  } = useTodoEditing({
    onTodoUpdated: handleTodoUpdated,
    todoStates,
  });

  const fetchViews = useCallback(async () => {
    if (!apiUrl || !username || !password) return;

    try {
      api.configure(apiUrl, username, password);
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
      setError('Failed to load views');
      console.error(err);
    }
  }, [apiUrl, username, password]);

  const fetchViewEntries = useCallback(async (key: string) => {
    if (!apiUrl || !username || !password) return;

    setLoading(true);
    try {
      api.configure(apiUrl, username, password);
      const viewData = await api.getCustomView(key);
      setSelectedView(viewData);
      setError(null);
    } catch (err) {
      setError('Failed to load view entries');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, username, password]);

  useEffect(() => {
    fetchViews().finally(() => setLoading(false));
  }, [fetchViews]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedView) {
      await fetchViewEntries(selectedView.key);
    } else {
      await fetchViews();
    }
    setRefreshing(false);
  }, [fetchViews, fetchViewEntries, selectedView]);

  const handleViewPress = useCallback((view: CustomView) => {
    fetchViewEntries(view.key);
  }, [fetchViewEntries]);

  const handleBack = useCallback(() => {
    setSelectedView(null);
  }, []);

  if (loading) {
    return (
      <View testID="viewsLoadingView" style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator testID="viewsLoadingIndicator" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View testID="viewsErrorView" style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text testID="viewsErrorText" variant="bodyLarge" style={{ color: theme.colors.error }}>
          {error}
        </Text>
      </View>
    );
  }

  // Show view entries
  if (selectedView) {
    return (
      <View testID="viewEntriesScreen" style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
          <IconButton
            icon="arrow-left"
            onPress={handleBack}
            testID="viewBackButton"
          />
          <Text variant="titleMedium" style={styles.headerTitle}>
            {selectedView.name}
          </Text>
          <View style={{ width: 48 }} />
        </View>

        {selectedView.entries.length === 0 ? (
          <View testID="viewEmptyView" style={styles.centered}>
            <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
              No items in this view
            </Text>
          </View>
        ) : (
          <FlatList
            testID="viewEntriesList"
            data={selectedView.entries}
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

  // Show view list
  return (
    <View testID="viewsListScreen" style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
              style={[styles.viewItem, { borderBottomColor: theme.colors.outlineVariant }]}
              onPress={() => handleViewPress(item)}
            >
              <View style={styles.viewItemContent}>
                <Text variant="bodyLarge">{item.name}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  viewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  viewItemContent: {
    flex: 1,
  },
});
