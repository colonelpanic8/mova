import { useMutation } from "@/context/MutationContext";
import { api, Todo, TodoStatesResponse, TodoUpdates } from "@/services/api";
import { scheduleCustomNotification } from "@/services/notifications";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  Button,
  List,
  Modal,
  Portal,
  RadioButton,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";

// Helper function duplicated here to avoid circular dependency
function getTodoKey(todo: Todo): string {
  return todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
}

// Format a Date to YYYY-MM-DD using local time (not UTC)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type EditModalType =
  | "schedule"
  | "deadline"
  | "priority"
  | "state"
  | "remind"
  | null;

export interface UseTodoEditingOptions {
  onTodoUpdated?: (todo: Todo, updates: Partial<Todo>) => void;
  todoStates?: TodoStatesResponse | null;
}

export interface UseTodoEditingResult {
  // State
  completingIds: Set<string>;
  updatingIds: Set<string>;
  snackbar: { visible: boolean; message: string; isError: boolean };
  swipeableRefs: React.MutableRefObject<Map<string, Swipeable>>;

  // Actions
  handleTodoPress: (todo: Todo) => void;
  scheduleToday: (todo: Todo) => void;
  scheduleTomorrow: (todo: Todo) => void;
  openScheduleModal: (todo: Todo) => void;
  openDeadlineModal: (todo: Todo) => void;
  openPriorityModal: (todo: Todo) => void;
  openRemindModal: (todo: Todo) => void;
  openBodyEditor: (todo: Todo) => void;
  openSwipeable: (key: string) => void;
  dismissSnackbar: () => void;

  // Components
  EditModals: () => ReactNode;
}

export function useTodoEditing(
  options: UseTodoEditingOptions = {},
): UseTodoEditingResult {
  const { onTodoUpdated, todoStates } = options;
  const theme = useTheme();
  const { triggerRefresh } = useMutation();
  const router = useRouter();

  // Edit modal state
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editModalType, setEditModalType] = useState<EditModalType>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [remindPickerMode, setRemindPickerMode] = useState<"date" | "time">(
    "date",
  );
  const [remindDateTime, setRemindDateTime] = useState<Date>(new Date());

  // Loading states
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    visible: boolean;
    message: string;
    isError: boolean;
  }>({
    visible: false,
    message: "",
    isError: false,
  });

  // Refs for swipeables
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const closeEditModal = useCallback(() => {
    setEditingTodo(null);
    setEditModalType(null);
  }, []);

  const openEditModal = useCallback((todo: Todo, type: EditModalType) => {
    // Close swipeable
    const key = getTodoKey(todo);
    swipeableRefs.current.get(key)?.close();

    setEditingTodo(todo);
    setEditModalType(type);

    if (type === "schedule" || type === "deadline") {
      const existingDate = type === "schedule" ? todo.scheduled : todo.deadline;
      if (existingDate) {
        // Parse date-only strings as local time to avoid timezone shift
        const hasTime =
          existingDate.includes("T") && existingDate.includes(":");
        setSelectedDate(
          hasTime
            ? new Date(existingDate)
            : new Date(existingDate + "T00:00:00"),
        );
      } else {
        setSelectedDate(new Date());
      }
    } else if (type === "priority") {
      setSelectedPriority(todo.priority || "");
    } else if (type === "state") {
      setSelectedState(todo.todo || "");
    } else if (type === "remind") {
      // Default to 1 hour from now
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 1);
      defaultTime.setMinutes(0, 0, 0);
      setRemindDateTime(defaultTime);
      setRemindPickerMode("date");
    }
  }, []);

  const handleTodoPress = useCallback(
    (todo: Todo) => {
      openEditModal(todo, "state");
    },
    [openEditModal],
  );

  const openScheduleModal = useCallback(
    (todo: Todo) => {
      openEditModal(todo, "schedule");
    },
    [openEditModal],
  );

  const openDeadlineModal = useCallback(
    (todo: Todo) => {
      openEditModal(todo, "deadline");
    },
    [openEditModal],
  );

  const openPriorityModal = useCallback(
    (todo: Todo) => {
      openEditModal(todo, "priority");
    },
    [openEditModal],
  );

  const openRemindModal = useCallback(
    (todo: Todo) => {
      openEditModal(todo, "remind");
    },
    [openEditModal],
  );

  const openBodyEditor = useCallback(
    (todo: Todo) => {
      const key = getTodoKey(todo);
      swipeableRefs.current.get(key)?.close();
      router.push({
        pathname: "/body-editor",
        params: {
          id: todo.id || "",
          file: todo.file || "",
          pos: todo.pos?.toString() || "",
          title: todo.title || "",
          body: todo.body || "",
        },
      });
    },
    [router],
  );

  const openSwipeable = useCallback((key: string) => {
    // Close all other swipeables first
    swipeableRefs.current.forEach((swipeable, refKey) => {
      if (refKey !== key) {
        swipeable.close();
      }
    });
    // Open the requested one
    swipeableRefs.current.get(key)?.openRight();
  }, []);

  const scheduleToday = useCallback(
    async (todo: Todo) => {
      const key = getTodoKey(todo);
      swipeableRefs.current.get(key)?.close();
      setUpdatingIds((prev) => new Set(prev).add(key));

      const today = new Date();
      const dateString = formatLocalDate(today);

      try {
        const result = await api.updateTodo(todo, { scheduled: dateString });

        if (result.status === "updated") {
          setSnackbar({
            visible: true,
            message: `Scheduled for today: ${todo.title}`,
            isError: false,
          });
          onTodoUpdated?.(todo, { scheduled: dateString });
          triggerRefresh();
        } else {
          setSnackbar({
            visible: true,
            message: result.message || "Failed to schedule",
            isError: true,
          });
        }
      } catch (err) {
        console.error("Failed to schedule todo:", err);
        setSnackbar({
          visible: true,
          message: "Failed to schedule todo",
          isError: true,
        });
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [onTodoUpdated, triggerRefresh],
  );

  const scheduleTomorrow = useCallback(
    async (todo: Todo) => {
      const key = getTodoKey(todo);
      swipeableRefs.current.get(key)?.close();
      setUpdatingIds((prev) => new Set(prev).add(key));

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = formatLocalDate(tomorrow);

      try {
        const result = await api.updateTodo(todo, { scheduled: dateString });

        if (result.status === "updated") {
          setSnackbar({
            visible: true,
            message: `Scheduled for tomorrow: ${todo.title}`,
            isError: false,
          });
          onTodoUpdated?.(todo, { scheduled: dateString });
          triggerRefresh();
        } else {
          setSnackbar({
            visible: true,
            message: result.message || "Failed to schedule",
            isError: true,
          });
        }
      } catch (err) {
        console.error("Failed to schedule todo:", err);
        setSnackbar({
          visible: true,
          message: "Failed to schedule todo",
          isError: true,
        });
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [onTodoUpdated, triggerRefresh],
  );

  const handleUpdateTodo = useCallback(
    async (updates: TodoUpdates) => {
      console.log(
        "[handleUpdateTodo] called with updates:",
        updates,
        "editingTodo:",
        editingTodo?.title,
      );
      if (!editingTodo) {
        console.log("[handleUpdateTodo] No editingTodo, returning early");
        return;
      }

      const key = getTodoKey(editingTodo);
      setUpdatingIds((prev) => new Set(prev).add(key));

      try {
        console.log("[handleUpdateTodo] Calling api.updateTodo");
        const result = await api.updateTodo(editingTodo, updates);
        console.log("[handleUpdateTodo] API result:", result);

        if (result.status === "updated") {
          setSnackbar({
            visible: true,
            message: `Updated: ${editingTodo.title}`,
            isError: false,
          });
          onTodoUpdated?.(editingTodo, updates);
          triggerRefresh();
          closeEditModal();
        } else {
          setSnackbar({
            visible: true,
            message: result.message || "Failed to update",
            isError: true,
          });
        }
      } catch (err) {
        console.error("Failed to update todo:", err);
        setSnackbar({
          visible: true,
          message: "Failed to update todo",
          isError: true,
        });
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [editingTodo, onTodoUpdated, closeEditModal, triggerRefresh],
  );

  const handleStateChange = useCallback(
    async (newState: string) => {
      if (!editingTodo) return;

      const key = getTodoKey(editingTodo);
      setCompletingIds((prev) => new Set(prev).add(key));
      closeEditModal();

      try {
        const result = await api.setTodoState(editingTodo, newState);

        if (result.status === "completed") {
          setSnackbar({
            visible: true,
            message: `${editingTodo.title}: ${result.oldState} → ${result.newState}`,
            isError: false,
          });
          onTodoUpdated?.(editingTodo, { todo: result.newState || newState });
          triggerRefresh();
        } else {
          setSnackbar({
            visible: true,
            message: result.message || "Failed to change state",
            isError: true,
          });
        }
      } catch (err) {
        console.error("Failed to change todo state:", err);
        setSnackbar({
          visible: true,
          message: "Failed to change state",
          isError: true,
        });
      } finally {
        setCompletingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [editingTodo, onTodoUpdated, closeEditModal, triggerRefresh],
  );

  const handleSavePriority = useCallback(
    (priority: string | null) => {
      handleUpdateTodo({ priority });
    },
    [handleUpdateTodo],
  );

  const handleScheduleReminder = useCallback(async () => {
    if (!editingTodo) return;

    const now = new Date();
    if (remindDateTime <= now) {
      setSnackbar({
        visible: true,
        message: "Please select a future time",
        isError: true,
      });
      return;
    }

    const result = await scheduleCustomNotification(
      editingTodo,
      remindDateTime,
    );
    if (result) {
      setSnackbar({
        visible: true,
        message: `Reminder set for ${remindDateTime.toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        isError: false,
      });
      closeEditModal();
    } else {
      setSnackbar({
        visible: true,
        message: "Failed to schedule reminder",
        isError: true,
      });
    }
  }, [editingTodo, remindDateTime, closeEditModal]);

  const handleRemindDateChange = useCallback(
    (event: any, date?: Date) => {
      if (event.type === "dismissed") {
        closeEditModal();
        return;
      }
      if (date) {
        if (remindPickerMode === "date") {
          // Update the date portion, keep the time
          const newDateTime = new Date(remindDateTime);
          newDateTime.setFullYear(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
          );
          setRemindDateTime(newDateTime);
          // On Android, switch to time picker after date selection
          if (Platform.OS === "android") {
            setRemindPickerMode("time");
          }
        } else {
          // Update the time portion, keep the date
          const newDateTime = new Date(remindDateTime);
          newDateTime.setHours(date.getHours(), date.getMinutes(), 0, 0);
          setRemindDateTime(newDateTime);
          // On Android, schedule after time selection
          if (Platform.OS === "android") {
            // Schedule will happen when user confirms in modal
          }
        }
      }
    },
    [remindPickerMode, remindDateTime, closeEditModal],
  );

  const dismissSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, visible: false }));
  }, []);

  // Handle native date picker result
  const handleDatePickerChange = useCallback(
    (event: any, date?: Date) => {
      console.log(
        "[DatePicker] event:",
        event.type,
        "date:",
        date,
        "editModalType:",
        editModalType,
      );
      if (event.type === "dismissed") {
        closeEditModal();
        return;
      }
      if (
        date &&
        (editModalType === "schedule" || editModalType === "deadline")
      ) {
        const dateString = formatLocalDate(date);
        // API expects "scheduled" not "schedule"
        const fieldName =
          editModalType === "schedule" ? "scheduled" : editModalType;
        console.log(
          "[DatePicker] Updating with dateString:",
          dateString,
          "fieldName:",
          fieldName,
        );
        handleUpdateTodo({ [fieldName]: dateString });
      } else {
        console.log(
          "[DatePicker] Not updating - date:",
          date,
          "editModalType:",
          editModalType,
        );
      }
    },
    [editModalType, handleUpdateTodo, closeEditModal],
  );

  const EditModals = useCallback(() => {
    const allStates = todoStates
      ? [...todoStates.active, ...todoStates.done]
      : ["TODO", "NEXT", "WAITING", "DONE"];

    const isDateModal =
      editModalType === "schedule" || editModalType === "deadline";

    return (
      <>
        {/* Native Date Picker (Schedule/Deadline) - only on native platforms */}
        {isDateModal && Platform.OS !== "web" && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDatePickerChange}
          />
        )}

        <Portal>
          {/* Web Date Picker - hidden input that auto-opens picker */}
          {Platform.OS === "web" && isDateModal && (
            <input
              type="date"
              value={formatLocalDate(selectedDate)}
              onChange={(e) => {
                const parsed = new Date(e.target.value + "T00:00:00");
                if (!isNaN(parsed.getTime())) {
                  // Auto-save on selection
                  const dateString = formatLocalDate(parsed);
                  const fieldName =
                    editModalType === "schedule" ? "scheduled" : "deadline";
                  handleUpdateTodo({ [fieldName]: dateString });
                }
              }}
              onBlur={closeEditModal}
              ref={(el) => {
                // Auto-open the picker when mounted
                if (el) {
                  try {
                    el.showPicker();
                  } catch {
                    // Fallback: just focus if showPicker not supported
                    el.focus();
                  }
                }
              }}
              style={{
                position: "absolute",
                opacity: 0,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Priority Modal */}
          <Modal
            visible={editModalType === "priority"}
            onDismiss={closeEditModal}
            contentContainerStyle={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text variant="titleLarge" style={styles.modalTitle}>
              Set Priority
            </Text>

            <RadioButton.Group
              onValueChange={setSelectedPriority}
              value={selectedPriority}
            >
              <RadioButton.Item label="None" value="" />
              <RadioButton.Item label="A - Highest" value="A" />
              <RadioButton.Item label="B - High" value="B" />
              <RadioButton.Item label="C - Medium" value="C" />
              <RadioButton.Item label="D - Low" value="D" />
              <RadioButton.Item label="E - Lowest" value="E" />
            </RadioButton.Group>

            <View style={styles.modalButtons}>
              <Button mode="outlined" onPress={closeEditModal}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => handleSavePriority(selectedPriority || null)}
              >
                Save
              </Button>
            </View>
          </Modal>

          {/* State Modal */}
          <Modal
            visible={editModalType === "state"}
            onDismiss={closeEditModal}
            contentContainerStyle={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text variant="titleLarge" style={styles.modalTitle}>
              Change State
            </Text>
            <Text
              variant="bodyMedium"
              style={styles.modalSubtitle}
              numberOfLines={1}
            >
              {editingTodo?.title}
            </Text>

            <RadioButton.Group
              onValueChange={setSelectedState}
              value={selectedState}
            >
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
              <Button mode="outlined" onPress={closeEditModal}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => handleStateChange(selectedState)}
                disabled={selectedState === editingTodo?.todo}
              >
                Change
              </Button>
            </View>
          </Modal>

          {/* Remind Modal */}
          <Modal
            visible={editModalType === "remind"}
            onDismiss={closeEditModal}
            contentContainerStyle={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text variant="titleLarge" style={styles.modalTitle}>
              Set Reminder
            </Text>
            <Text
              variant="bodyMedium"
              style={styles.modalSubtitle}
              numberOfLines={1}
            >
              {editingTodo?.title}
            </Text>

            {Platform.OS !== "web" && (
              <View style={styles.remindPickerContainer}>
                <List.Item
                  title="Date"
                  description={remindDateTime.toLocaleDateString()}
                  left={(props) => <List.Icon {...props} icon="calendar" />}
                  onPress={() => setRemindPickerMode("date")}
                />
                <List.Item
                  title="Time"
                  description={remindDateTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  left={(props) => (
                    <List.Icon {...props} icon="clock-outline" />
                  )}
                  onPress={() => setRemindPickerMode("time")}
                />
              </View>
            )}

            {Platform.OS === "web" && (
              <input
                type="datetime-local"
                value={`${remindDateTime.getFullYear()}-${String(remindDateTime.getMonth() + 1).padStart(2, "0")}-${String(remindDateTime.getDate()).padStart(2, "0")}T${String(remindDateTime.getHours()).padStart(2, "0")}:${String(remindDateTime.getMinutes()).padStart(2, "0")}`}
                onChange={(e) => {
                  const parsed = new Date(e.target.value);
                  if (!isNaN(parsed.getTime())) {
                    setRemindDateTime(parsed);
                  }
                }}
                style={{
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.outline}`,
                  marginBottom: 16,
                }}
              />
            )}

            <View style={styles.modalButtons}>
              <Button mode="outlined" onPress={closeEditModal}>
                Cancel
              </Button>
              <Button mode="contained" onPress={handleScheduleReminder}>
                Set Reminder
              </Button>
            </View>
          </Modal>
        </Portal>

        {/* Native DateTime Picker for Remind modal */}
        {editModalType === "remind" && Platform.OS !== "web" && (
          <DateTimePicker
            value={remindDateTime}
            mode={remindPickerMode}
            display="default"
            onChange={handleRemindDateChange}
          />
        )}

        <Snackbar
          visible={snackbar.visible}
          onDismiss={dismissSnackbar}
          duration={2000}
          style={
            snackbar.isError
              ? { backgroundColor: theme.colors.error }
              : undefined
          }
          testID={snackbar.isError ? "errorSnackbar" : "successSnackbar"}
        >
          {snackbar.message}
        </Snackbar>
      </>
    );
  }, [
    editModalType,
    editingTodo,
    selectedDate,
    selectedPriority,
    selectedState,
    remindDateTime,
    remindPickerMode,
    todoStates,
    snackbar,
    theme,
    closeEditModal,
    handleDatePickerChange,
    handleRemindDateChange,
    handleSavePriority,
    handleScheduleReminder,
    handleStateChange,
    handleUpdateTodo,
    dismissSnackbar,
  ]);

  return {
    completingIds,
    updatingIds,
    snackbar,
    swipeableRefs,
    handleTodoPress,
    scheduleToday,
    scheduleTomorrow,
    openScheduleModal,
    openDeadlineModal,
    openPriorityModal,
    openRemindModal,
    openBodyEditor,
    openSwipeable,
    dismissSnackbar,
    EditModals,
  };
}

// Context for TodoItem to consume editing functionality directly
const TodoEditingContext = createContext<UseTodoEditingResult | null>(null);

export function useTodoEditingContext(): UseTodoEditingResult {
  const context = useContext(TodoEditingContext);
  if (!context) {
    throw new Error(
      "useTodoEditingContext must be used within a TodoEditingProvider",
    );
  }
  return context;
}

export interface TodoEditingProviderProps {
  children: ReactNode;
  onTodoUpdated?: (todo: Todo, updates: Partial<Todo>) => void;
  todoStates?: TodoStatesResponse | null;
}

export function TodoEditingProvider({
  children,
  onTodoUpdated,
  todoStates,
}: TodoEditingProviderProps) {
  const editing = useTodoEditing({ onTodoUpdated, todoStates });

  return (
    <TodoEditingContext.Provider value={editing}>
      {children}
      <editing.EditModals />
    </TodoEditingContext.Provider>
  );
}

const styles = StyleSheet.create({
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
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
  remindPickerContainer: {
    marginBottom: 8,
  },
});

export default useTodoEditing;
