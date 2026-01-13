import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { Searchbar, Text, useTheme, ActivityIndicator, Chip, Snackbar, Portal, Modal, Button, RadioButton, Switch } from 'react-native-paper';
import { Swipeable } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/context/AuthContext';
import { api, Todo, TodoUpdates, TodoStatesResponse } from '@/services/api';

type EditModalType = 'schedule' | 'deadline' | 'priority' | 'state' | null;

export default function SearchScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; isError: boolean }>({
    visible: false,
    message: '',
    isError: false,
  });

  // Edit modal state
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editModalType, setEditModalType] = useState<EditModalType>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [includeTime, setIncludeTime] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');

  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

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

  const getTodoKey = (todo: Todo): string => {
    return todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
  };

  const handleTodoPress = (todo: Todo) => {
    // Open state transition modal
    setEditingTodo(todo);
    setEditModalType('state');
    setSelectedState(todo.todo || '');
  };

  const handleStateChange = async (newState: string) => {
    if (!editingTodo) return;

    const key = getTodoKey(editingTodo);
    setCompletingIds(prev => new Set(prev).add(key));
    closeEditModal();

    try {
      const result = await api.setTodoState(editingTodo, newState);

      if (result.status === 'completed') {
        setSnackbar({
          visible: true,
          message: `${editingTodo.title}: ${result.oldState} → ${result.newState}`,
          isError: false
        });
        setTodos(prev => prev.map(t =>
          getTodoKey(t) === key ? { ...t, todo: result.newState || newState } : t
        ));
      } else {
        setSnackbar({
          visible: true,
          message: result.message || 'Failed to change state',
          isError: true
        });
      }
    } catch (err) {
      console.error('Failed to change todo state:', err);
      setSnackbar({ visible: true, message: 'Failed to change state', isError: true });
    } finally {
      setCompletingIds(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const openEditModal = (todo: Todo, type: EditModalType) => {
    // Close swipeable
    const key = getTodoKey(todo);
    swipeableRefs.current.get(key)?.close();

    setEditingTodo(todo);
    setEditModalType(type);

    if (type === 'schedule' || type === 'deadline') {
      const existingDate = type === 'schedule' ? todo.scheduled : todo.deadline;
      if (existingDate) {
        setSelectedDate(new Date(existingDate));
        setIncludeTime(existingDate.includes('T') && existingDate.includes(':'));
      } else {
        setSelectedDate(new Date());
        setIncludeTime(false);
      }
      setShowTimePicker(false);
    } else if (type === 'priority') {
      setSelectedPriority(todo.priority || '');
    }
  };

  const closeEditModal = () => {
    setEditingTodo(null);
    setEditModalType(null);
    setShowTimePicker(false);
  };

  const handleUpdateTodo = async (updates: TodoUpdates) => {
    if (!editingTodo) return;

    const key = getTodoKey(editingTodo);
    setUpdatingIds(prev => new Set(prev).add(key));

    try {
      const result = await api.updateTodo(editingTodo, updates);

      if (result.status === 'updated') {
        setSnackbar({
          visible: true,
          message: `Updated: ${editingTodo.title}`,
          isError: false
        });
        // Update local state
        setTodos(prev => prev.map(t =>
          getTodoKey(t) === key ? { ...t, ...updates } : t
        ));
        closeEditModal();
      } else {
        setSnackbar({
          visible: true,
          message: result.message || 'Failed to update',
          isError: true
        });
      }
    } catch (err) {
      console.error('Failed to update todo:', err);
      setSnackbar({ visible: true, message: 'Failed to update todo', isError: true });
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleSaveDate = () => {
    if (!editModalType || (editModalType !== 'schedule' && editModalType !== 'deadline')) return;

    let dateString: string;
    if (includeTime) {
      dateString = selectedDate.toISOString().slice(0, 19);
    } else {
      dateString = selectedDate.toISOString().slice(0, 10);
    }

    handleUpdateTodo({ [editModalType]: dateString });
  };

  const handleClearDate = () => {
    if (!editModalType || (editModalType !== 'schedule' && editModalType !== 'deadline')) return;
    handleUpdateTodo({ [editModalType]: null });
  };

  const handleSavePriority = (priority: string | null) => {
    handleUpdateTodo({ priority });
  };

  const renderRightActions = (todo: Todo) => {
    return (
      <View style={styles.swipeActions}>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: theme.colors.primary }]}
          onPress={() => openEditModal(todo, 'schedule')}
        >
          <Text style={styles.swipeActionText}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: theme.colors.error }]}
          onPress={() => openEditModal(todo, 'deadline')}
        >
          <Text style={styles.swipeActionText}>Deadline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: theme.colors.tertiary }]}
          onPress={() => openEditModal(todo, 'priority')}
        >
          <Text style={styles.swipeActionText}>Priority</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDateModal = () => {
    const isSchedule = editModalType === 'schedule';
    const title = isSchedule ? 'Set Schedule' : 'Set Deadline';

    return (
      <Modal
        visible={editModalType === 'schedule' || editModalType === 'deadline'}
        onDismiss={closeEditModal}
        contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>{title}</Text>

        <View style={styles.datePickerContainer}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => date && setSelectedDate(date)}
          />
        </View>

        <View style={styles.switchRow}>
          <Text>Include time</Text>
          <Switch value={includeTime} onValueChange={setIncludeTime} />
        </View>

        {includeTime && (
          <View style={styles.datePickerContainer}>
            <DateTimePicker
              value={selectedDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => date && setSelectedDate(date)}
            />
          </View>
        )}

        <View style={styles.modalButtons}>
          <Button mode="outlined" onPress={handleClearDate}>Clear</Button>
          <Button mode="outlined" onPress={closeEditModal}>Cancel</Button>
          <Button mode="contained" onPress={handleSaveDate}>Save</Button>
        </View>
      </Modal>
    );
  };

  const renderPriorityModal = () => {
    return (
      <Modal
        visible={editModalType === 'priority'}
        onDismiss={closeEditModal}
        contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>Set Priority</Text>

        <RadioButton.Group onValueChange={setSelectedPriority} value={selectedPriority}>
          <RadioButton.Item label="None" value="" />
          <RadioButton.Item label="A - High" value="A" />
          <RadioButton.Item label="B - Medium" value="B" />
          <RadioButton.Item label="C - Low" value="C" />
        </RadioButton.Group>

        <View style={styles.modalButtons}>
          <Button mode="outlined" onPress={closeEditModal}>Cancel</Button>
          <Button
            mode="contained"
            onPress={() => handleSavePriority(selectedPriority || null)}
          >
            Save
          </Button>
        </View>
      </Modal>
    );
  };

  const renderStateModal = () => {
    const allStates = todoStates
      ? [...todoStates.active, ...todoStates.done]
      : ['TODO', 'NEXT', 'WAITING', 'DONE'];

    return (
      <Modal
        visible={editModalType === 'state'}
        onDismiss={closeEditModal}
        contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>Change State</Text>
        <Text variant="bodyMedium" style={styles.modalSubtitle} numberOfLines={1}>
          {editingTodo?.title}
        </Text>

        <RadioButton.Group onValueChange={setSelectedState} value={selectedState}>
          {allStates.map((state) => (
            <RadioButton.Item
              key={state}
              label={state}
              value={state}
              labelStyle={{
                color: todoStates?.done.includes(state)
                  ? theme.colors.outline
                  : theme.colors.onSurface,
              }}
            />
          ))}
        </RadioButton.Group>

        <View style={styles.modalButtons}>
          <Button mode="outlined" onPress={closeEditModal}>Cancel</Button>
          <Button
            mode="contained"
            onPress={() => handleStateChange(selectedState)}
            disabled={selectedState === editingTodo?.todo}
          >
            Change
          </Button>
        </View>
      </Modal>
    );
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
            const isUpdating = updatingIds.has(key);

            return (
              <Swipeable
                ref={(ref) => {
                  if (ref) swipeableRefs.current.set(key, ref);
                }}
                renderRightActions={() => renderRightActions(item)}
                overshootRight={false}
              >
                <View style={[
                  styles.todoItem,
                  {
                    borderBottomColor: theme.colors.outlineVariant,
                    backgroundColor: theme.colors.background,
                    opacity: isUpdating ? 0.6 : 1,
                  }
                ]}>
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
                    {item.priority && (
                      <Chip
                        mode="outlined"
                        compact
                        style={styles.priorityChip}
                        textStyle={{ fontSize: 10 }}
                      >
                        #{item.priority}
                      </Chip>
                    )}
                    <Text variant="bodyMedium" style={styles.todoTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    {item.scheduled && (
                      <Text style={[styles.metaText, { color: theme.colors.primary }]}>
                        S: {formatDate(item.scheduled)}
                      </Text>
                    )}
                    {item.deadline && (
                      <Text style={[styles.metaText, { color: theme.colors.error }]}>
                        D: {formatDate(item.deadline)}
                      </Text>
                    )}
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
              </Swipeable>
            );
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <Portal>
        {renderDateModal()}
        {renderPriorityModal()}
        {renderStateModal()}
      </Portal>

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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const hasTime = dateString.includes('T') && dateString.includes(':');
  if (hasTime) {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
    minHeight: 24,
    justifyContent: 'center',
  },
  todoChipLoading: {
    opacity: 0.6,
  },
  priorityChip: {
    height: 20,
  },
  todoTitle: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
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
  swipeActions: {
    flexDirection: 'row',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    paddingHorizontal: 8,
  },
  swipeActionText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  modalContent: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    marginBottom: 8,
  },
  modalSubtitle: {
    marginBottom: 16,
    opacity: 0.7,
  },
  datePickerContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
});
