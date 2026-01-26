import { StatePill } from "@/components/StatePill";
import { useApi } from "@/context/ApiContext";
import { useMutation } from "@/context/MutationContext";
import { useSettings } from "@/context/SettingsContext";
import {
  Timestamp,
  Todo,
  TodoStatesResponse,
  TodoUpdates,
} from "@/services/api";
import { formatLocalDate, formatLocalDateTime } from "@/utils/dateFormatting";
import { dateToTimestamp, timestampToDate } from "@/utils/timestampConversion";
import { getTodoKey } from "@/utils/todoKey";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  Button,
  Dialog,
  List,
  Modal,
  Portal,
  RadioButton,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";

type EditModalType =
  | "schedule"
  | "deadline"
  | "scheduleTime"
  | "deadlineTime"
  | "schedule-confirm"
  | "deadline-confirm"
  | "priority"
  | "state"
  | "remind"
  | "quickScheduleTime"
  | null;

export interface UseTodoEditingOptions {
  onTodoUpdated?: (todo: Todo, updates: Partial<Todo>) => void;
  todoStates?: TodoStatesResponse | null;
}

export interface UseTodoEditingResult {
  // State
  completingIds: Set<string>;
  updatingIds: Set<string>;
  deletingIds: Set<string>;
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
  openDeleteConfirm: (todo: Todo) => void;
  quickComplete: (todo: Todo, state: string, overrideDate?: Date) => void;
  dismissSnackbar: () => void;

  // Components
  EditModals: () => ReactNode;
}

export function useTodoEditing(
  options: UseTodoEditingOptions = {},
): UseTodoEditingResult {
  const { onTodoUpdated, todoStates } = options;
  const api = useApi();
  const theme = useTheme();
  const { triggerRefresh } = useMutation();
  const { quickScheduleIncludeTime, useClientCompletionTime } = useSettings();

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
  const [quickScheduleDate, setQuickScheduleDate] = useState<Date>(new Date());
  const [stateOverrideDate, setStateOverrideDate] = useState<Date | null>(null);
  const [showStateOverrideDatePicker, setShowStateOverrideDatePicker] =
    useState(false);

  // Loading states
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteConfirmTodo, setDeleteConfirmTodo] = useState<Todo | null>(null);

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
      const existingTs = type === "schedule" ? todo.scheduled : todo.deadline;
      const existingDate = timestampToDate(existingTs);
      if (existingDate) {
        setSelectedDate(existingDate);
      } else {
        setSelectedDate(new Date());
      }
    } else if (type === "priority") {
      setSelectedPriority(todo.priority || "");
    } else if (type === "state") {
      setSelectedState(todo.todo || "");
      setStateOverrideDate(null);
      setShowStateOverrideDatePicker(false);
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

  const applyQuickSchedule = useCallback(
    async (todo: Todo, timestamp: Timestamp) => {
      if (!api) return;
      const key = getTodoKey(todo);
      setUpdatingIds((prev) => new Set(prev).add(key));

      try {
        const result = await api.updateTodo(todo, { scheduled: timestamp });

        if (result.status === "updated") {
          setSnackbar({
            visible: true,
            message: `Scheduled: ${todo.title}`,
            isError: false,
          });
          onTodoUpdated?.(todo, { scheduled: timestamp });
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
    [api, onTodoUpdated, triggerRefresh],
  );

  const scheduleToday = useCallback(
    (todo: Todo) => {
      const key = getTodoKey(todo);
      swipeableRefs.current.get(key)?.close();

      const today = new Date();
      today.setSeconds(0, 0);
      // Always apply date immediately
      applyQuickSchedule(todo, dateToTimestamp(today, false));
      // Then open time picker if setting is enabled
      if (quickScheduleIncludeTime) {
        setQuickScheduleDate(today);
        setEditingTodo(todo);
        setEditModalType("quickScheduleTime");
      }
    },
    [quickScheduleIncludeTime, applyQuickSchedule],
  );

  const scheduleTomorrow = useCallback(
    (todo: Todo) => {
      const key = getTodoKey(todo);
      swipeableRefs.current.get(key)?.close();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setSeconds(0, 0);
      // Always apply date immediately
      applyQuickSchedule(todo, dateToTimestamp(tomorrow, false));
      // Then open time picker if setting is enabled
      if (quickScheduleIncludeTime) {
        setQuickScheduleDate(tomorrow);
        setEditingTodo(todo);
        setEditModalType("quickScheduleTime");
      }
    },
    [quickScheduleIncludeTime, applyQuickSchedule],
  );

  const handleUpdateTodo = useCallback(
    async (updates: TodoUpdates) => {
      if (!editingTodo || !api) {
        return;
      }

      const key = getTodoKey(editingTodo);
      setUpdatingIds((prev) => new Set(prev).add(key));

      try {
        const result = await api.updateTodo(editingTodo, updates);

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
    [api, editingTodo, onTodoUpdated, closeEditModal, triggerRefresh],
  );

  const handleStateChange = useCallback(
    async (newState: string, overrideDate?: Date | null) => {
      if (!editingTodo || !api) return;

      const key = getTodoKey(editingTodo);
      setCompletingIds((prev) => new Set(prev).add(key));
      closeEditModal();

      try {
        // Use override date if provided, otherwise use current datetime if setting enabled
        let overrideDateStr: string | undefined;
        if (overrideDate) {
          overrideDateStr = formatLocalDate(overrideDate);
        } else if (useClientCompletionTime) {
          overrideDateStr = formatLocalDateTime(new Date());
        }
        const result = await api.setTodoState(
          editingTodo,
          newState,
          overrideDateStr,
        );

        if (result.status === "completed") {
          const dateMsg = overrideDate
            ? ` (as of ${formatLocalDate(overrideDate)})`
            : "";
          setSnackbar({
            visible: true,
            message: `${editingTodo.title}: ${result.oldState} → ${result.newState}${dateMsg}`,
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
    [
      api,
      editingTodo,
      onTodoUpdated,
      closeEditModal,
      triggerRefresh,
      useClientCompletionTime,
    ],
  );

  const quickComplete = useCallback(
    async (todo: Todo, state: string, overrideDate?: Date) => {
      if (!api) return;
      const key = getTodoKey(todo);
      // Close swipeable if open
      swipeableRefs.current.get(key)?.close();
      setCompletingIds((prev) => new Set(prev).add(key));

      try {
        // Use override date if provided, otherwise use current datetime if setting enabled
        let overrideDateStr: string | undefined;
        if (overrideDate) {
          overrideDateStr = formatLocalDate(overrideDate);
        } else if (useClientCompletionTime) {
          overrideDateStr = formatLocalDateTime(new Date());
        }
        const result = await api.setTodoState(todo, state, overrideDateStr);

        if (result.status === "completed") {
          const dateMsg = overrideDate
            ? ` (${formatLocalDate(overrideDate)})`
            : "";
          setSnackbar({
            visible: true,
            message: `${todo.title}: ${result.oldState} → ${result.newState}${dateMsg}`,
            isError: false,
          });
          onTodoUpdated?.(todo, { todo: result.newState || state });
          triggerRefresh();
        } else {
          setSnackbar({
            visible: true,
            message: result.message || "Failed to complete",
            isError: true,
          });
        }
      } catch (err) {
        console.error("Failed to quick complete:", err);
        setSnackbar({
          visible: true,
          message: "Failed to complete",
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
    [
      api,
      onTodoUpdated,
      triggerRefresh,
      swipeableRefs,
      useClientCompletionTime,
    ],
  );

  const handleDeleteTodo = useCallback(
    async (todo: Todo) => {
      if (!api) return;
      const key = getTodoKey(todo);
      setDeletingIds((prev) => new Set(prev).add(key));
      setDeleteConfirmTodo(null);

      try {
        const result = await api.deleteTodo(todo);
        if (result.status === "deleted") {
          setSnackbar({
            visible: true,
            message: `Deleted: ${todo.title}`,
            isError: false,
          });
          triggerRefresh();
        } else {
          setSnackbar({
            visible: true,
            message: result.message || "Failed to delete",
            isError: true,
          });
        }
      } catch (err) {
        console.error("Failed to delete todo:", err);
        setSnackbar({
          visible: true,
          message: "Failed to delete todo",
          isError: true,
        });
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [api, triggerRefresh],
  );

  const openDeleteConfirm = useCallback((todo: Todo) => {
    const key = getTodoKey(todo);
    swipeableRefs.current.get(key)?.close();
    setDeleteConfirmTodo(todo);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirmTodo(null);
  }, []);

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

    // Custom notification scheduling removed - server is now source of truth
    // TODO: Implement via API by setting WILD_NOTIFIER_NOTIFY_AT property
    setSnackbar({
      visible: true,
      message:
        "Custom reminders not yet supported with server-driven notifications",
      isError: true,
    });
    closeEditModal();
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

  // Handle native date picker result - transition to confirm modal
  const handleDatePickerChange = useCallback(
    (event: any, date?: Date) => {
      if (event.type === "dismissed") {
        closeEditModal();
        return;
      }
      if (
        date &&
        (editModalType === "schedule" || editModalType === "deadline")
      ) {
        setSelectedDate(date);
        // Transition to confirm modal where user can optionally add repeater and time
        setEditModalType(
          editModalType === "schedule"
            ? "schedule-confirm"
            : "deadline-confirm",
        );
      }
    },
    [editModalType, closeEditModal],
  );

  // Handle quick schedule time picker result - adds time to already-scheduled item
  const handleQuickScheduleTimeChange = useCallback(
    (event: any, date?: Date) => {
      if (event.type === "dismissed") {
        closeEditModal();
        return;
      }
      if (date && editingTodo) {
        const combined = new Date(quickScheduleDate);
        combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
        closeEditModal();
        applyQuickSchedule(editingTodo, dateToTimestamp(combined, true));
      }
    },
    [quickScheduleDate, editingTodo, closeEditModal, applyQuickSchedule],
  );

  // Save schedule/deadline (modal only sets date, not repeater - repeaters are set in edit page)
  const handleSaveDateTime = useCallback(
    (type: "schedule" | "deadline", includeTime: boolean = false) => {
      const fieldName = type === "schedule" ? "scheduled" : "deadline";

      const updates: TodoUpdates = {
        [fieldName]: dateToTimestamp(selectedDate, includeTime),
      };

      handleUpdateTodo(updates);
    },
    [selectedDate, handleUpdateTodo],
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

        {/* Quick Schedule Time Picker (Today/Tomorrow with time) */}
        {editModalType === "quickScheduleTime" && Platform.OS !== "web" && (
          <DateTimePicker
            value={quickScheduleDate}
            mode="time"
            display="default"
            onChange={handleQuickScheduleTimeChange}
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
                  setSelectedDate(parsed);
                  // Transition to confirm modal where user can add repeater and time
                  setEditModalType(
                    editModalType === "schedule"
                      ? "schedule-confirm"
                      : "deadline-confirm",
                  );
                }
              }}
              onBlur={() => {
                // Only close if we haven't transitioned to confirm modal
                if (
                  editModalType === "schedule" ||
                  editModalType === "deadline"
                ) {
                  closeEditModal();
                }
              }}
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

          {/* Web Quick Schedule Time Picker */}
          {Platform.OS === "web" && editModalType === "quickScheduleTime" && (
            <input
              type="time"
              value={`${String(quickScheduleDate.getHours()).padStart(2, "0")}:${String(quickScheduleDate.getMinutes()).padStart(2, "0")}`}
              onChange={(e) => {
                if (e.target.value && editingTodo) {
                  const [hours, minutes] = e.target.value
                    .split(":")
                    .map(Number);
                  const combined = new Date(quickScheduleDate);
                  combined.setHours(hours, minutes, 0, 0);
                  closeEditModal();
                  applyQuickSchedule(
                    editingTodo,
                    dateToTimestamp(combined, true),
                  );
                }
              }}
              onBlur={closeEditModal}
              ref={(el) => {
                if (el) {
                  try {
                    el.showPicker();
                  } catch {
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

          {/* Schedule Confirm Modal */}
          <Modal
            visible={editModalType === "schedule-confirm"}
            onDismiss={closeEditModal}
            contentContainerStyle={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text variant="titleLarge" style={styles.modalTitle}>
              Schedule
            </Text>
            <Text variant="bodyMedium" style={styles.modalSubtitle}>
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>

            <View style={styles.modalButtons}>
              <Button mode="outlined" onPress={closeEditModal}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => handleSaveDateTime("schedule")}
              >
                Save
              </Button>
            </View>
          </Modal>

          {/* Deadline Confirm Modal */}
          <Modal
            visible={editModalType === "deadline-confirm"}
            onDismiss={closeEditModal}
            contentContainerStyle={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text variant="titleLarge" style={styles.modalTitle}>
              Deadline
            </Text>
            <Text variant="bodyMedium" style={styles.modalSubtitle}>
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>

            <View style={styles.modalButtons}>
              <Button mode="outlined" onPress={closeEditModal}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => handleSaveDateTime("deadline")}
              >
                Save
              </Button>
            </View>
          </Modal>

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
                <Pressable
                  key={state}
                  onPress={() => setSelectedState(state)}
                  style={styles.stateRow}
                >
                  <RadioButton value={state} />
                  <StatePill state={state} selected={state === selectedState} dimWhenUnselected={false} />
                </Pressable>
              ))}
            </RadioButton.Group>

            {/* Override date option */}
            <List.Item
              title="Effective Date"
              description={
                stateOverrideDate
                  ? stateOverrideDate.toLocaleDateString()
                  : "Today (default)"
              }
              left={(props) => <List.Icon {...props} icon="calendar" />}
              onPress={() => {
                if (Platform.OS === "web") {
                  // Web: toggle picker visibility
                  setShowStateOverrideDatePicker(!showStateOverrideDatePicker);
                } else {
                  // Native: show native picker
                  setShowStateOverrideDatePicker(true);
                }
              }}
              right={(props) =>
                stateOverrideDate ? (
                  <Pressable
                    onPress={() => setStateOverrideDate(null)}
                    style={{ justifyContent: "center" }}
                  >
                    <List.Icon {...props} icon="close" />
                  </Pressable>
                ) : null
              }
              style={styles.overrideDateItem}
            />
            {Platform.OS === "web" && showStateOverrideDatePicker && (
              <input
                type="date"
                value={
                  stateOverrideDate
                    ? formatLocalDate(stateOverrideDate)
                    : formatLocalDate(new Date())
                }
                onChange={(e) => {
                  const parsed = new Date(e.target.value + "T00:00:00");
                  if (!isNaN(parsed.getTime())) {
                    setStateOverrideDate(parsed);
                  }
                  setShowStateOverrideDatePicker(false);
                }}
                style={{
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.outline}`,
                  marginBottom: 8,
                }}
              />
            )}

            <View style={styles.modalButtons}>
              <Button mode="outlined" onPress={closeEditModal}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() =>
                  handleStateChange(selectedState, stateOverrideDate)
                }
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

          {/* Delete Confirmation Dialog */}
          <Dialog visible={!!deleteConfirmTodo} onDismiss={closeDeleteConfirm}>
            <Dialog.Title>Delete Todo?</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">{deleteConfirmTodo?.title}</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={closeDeleteConfirm}>Cancel</Button>
              <Button
                onPress={() =>
                  deleteConfirmTodo && handleDeleteTodo(deleteConfirmTodo)
                }
                textColor={theme.colors.error}
              >
                Delete
              </Button>
            </Dialog.Actions>
          </Dialog>
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

        {/* Native Date Picker for State Override Date */}
        {showStateOverrideDatePicker && Platform.OS !== "web" && (
          <DateTimePicker
            value={stateOverrideDate || new Date()}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowStateOverrideDatePicker(false);
              if (event.type !== "dismissed" && date) {
                setStateOverrideDate(date);
              }
            }}
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
    quickScheduleDate,
    stateOverrideDate,
    showStateOverrideDatePicker,
    todoStates,
    snackbar,
    theme,
    closeEditModal,
    handleDatePickerChange,
    handleQuickScheduleTimeChange,
    handleRemindDateChange,
    handleSavePriority,
    handleSaveDateTime,
    handleScheduleReminder,
    handleStateChange,
    handleUpdateTodo,
    applyQuickSchedule,
    dismissSnackbar,
    deleteConfirmTodo,
    handleDeleteTodo,
    closeDeleteConfirm,
  ]);

  return {
    completingIds,
    updatingIds,
    deletingIds,
    snackbar,
    swipeableRefs,
    handleTodoPress,
    scheduleToday,
    scheduleTomorrow,
    openScheduleModal,
    openDeadlineModal,
    openPriorityModal,
    openRemindModal,
    openDeleteConfirm,
    quickComplete,
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
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
  },
  overrideDateItem: {
    marginTop: 8,
    marginBottom: 0,
    paddingVertical: 0,
  },
});

export default useTodoEditing;
