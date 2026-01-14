import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { Text, useTheme, ActivityIndicator, IconButton } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '@/context/AuthContext';
import { api, AgendaResponse, AgendaEntry, Todo, TodoStatesResponse } from '@/services/api';
import { TodoItem, getTodoKey } from '@/components/TodoItem';
import { useTodoEditing } from '@/hooks/useTodoEditing';

function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function AgendaScreen() {
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);
  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  const handleTodoUpdated = useCallback((todo: Todo, updates: Partial<Todo>) => {
    setAgenda(prev => {
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

  const fetchAgenda = useCallback(async (date: Date) => {
    if (!apiUrl || !username || !password) return;

    try {
      api.configure(apiUrl, username, password);
      const dateString = formatDateForApi(date);
      const [agendaData, statesData] = await Promise.all([
        api.getAgenda('day', dateString),
        api.getTodoStates().catch(() => null),
      ]);
      setAgenda(agendaData);
      if (statesData) {
        setTodoStates(statesData);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load agenda');
      console.error(err);
    }
  }, [apiUrl, username, password]);

  useEffect(() => {
    fetchAgenda(selectedDate).finally(() => setLoading(false));
  }, [fetchAgenda, selectedDate]);

  const goToPreviousDay = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const goToNextDay = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const onDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAgenda(selectedDate);
    setRefreshing(false);
  }, [fetchAgenda, selectedDate]);

  if (loading) {
    return (
      <View testID="agendaLoadingView" style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator testID="agendaLoadingIndicator" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View testID="agendaErrorView" style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text testID="agendaErrorText" variant="bodyLarge" style={{ color: theme.colors.error }}>
          {error}
        </Text>
      </View>
    );
  }

  const isToday = formatDateForApi(selectedDate) === formatDateForApi(new Date());

  return (
    <View testID="agendaScreen" style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.dateNavigation}>
          <IconButton
            icon="chevron-left"
            onPress={goToPreviousDay}
            testID="agendaPrevDay"
          />
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={styles.dateButton}
            testID="agendaDateButton"
          >
            <Text testID="agendaDateHeader" variant="titleMedium" style={styles.dateText}>
              {agenda?.date ? formatDateForDisplay(agenda.date) : ''}
            </Text>
          </TouchableOpacity>
          <IconButton
            icon="chevron-right"
            onPress={goToNextDay}
            testID="agendaNextDay"
          />
        </View>
        {!isToday && (
          <TouchableOpacity onPress={goToToday} style={styles.todayButton} testID="agendaTodayButton">
            <Text style={{ color: theme.colors.primary }}>Go to Today</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          testID="agendaDatePicker"
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
        />
      )}

      {agenda?.entries.length === 0 ? (
        <View testID="agendaEmptyView" style={styles.centered}>
          <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
            No items for today
          </Text>
        </View>
      ) : (
        <FlatList
          testID="agendaList"
          data={agenda?.entries}
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
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dateText: {
    textAlign: 'center',
  },
  todayButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
