import {
  EditModalType,
  TodoEditModals,
} from "@/components/todoEditing/TodoEditModals";
import { useSettings } from "@/context/SettingsContext";
import { AppSnackbar } from "@/context/SnackbarContext";
import { useTodoMutations } from "@/hooks/useTodoMutations";
import { Todo, TodoStatesResponse } from "@/services/api";
import { formatLocalDate } from "@/utils/dateFormatting";
import { dateToTimestamp, timestampToDate } from "@/utils/timestampConversion";
import { getTodoKey } from "@/utils/todoKey";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Swipeable } from "react-native-gesture-handler";

export interface TodoEditingContextValue {
  // Loading state per todo key
  completingIds: Set<string>;
  updatingIds: Set<string>;
  deletingIds: Set<string>;

  // Swipeable coordination
  /** Register a row's Swipeable; returns an unregister function. */
  registerSwipeable: (key: string, swipeable: Swipeable) => () => void;
  /** Close every registered Swipeable except the given one. */
  closeOtherSwipeables: (key: string) => void;

  // Actions
  handleTodoPress: (todo: Todo) => void;
  scheduleToday: (todo: Todo) => void;
  scheduleTomorrow: (todo: Todo) => void;
  openScheduleModal: (todo: Todo) => void;
  openDeadlineModal: (todo: Todo) => void;
  openPriorityModal: (todo: Todo) => void;
  openDeleteConfirm: (todo: Todo) => void;
  quickComplete: (todo: Todo, state: string, overrideDate?: Date) => void;
}

const TodoEditingContext = createContext<TodoEditingContextValue | null>(null);

export function useTodoEditingContext(): TodoEditingContextValue {
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
  const { quickScheduleIncludeTime } = useSettings();
  const mutations = useTodoMutations({ onTodoUpdated });
  const { scheduleTodo, updateTodo, changeTodoState, deleteTodo } = mutations;

  // Modal orchestration state
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [modalType, setModalType] = useState<EditModalType>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [quickScheduleDate, setQuickScheduleDate] = useState<Date>(new Date());
  const [deleteConfirmTodo, setDeleteConfirmTodo] = useState<Todo | null>(null);

  // Swipeable rows register themselves so actions can close them
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const registerSwipeable = useCallback((key: string, swipeable: Swipeable) => {
    swipeableRefs.current.set(key, swipeable);
    return () => {
      swipeableRefs.current.delete(key);
    };
  }, []);

  const closeOtherSwipeables = useCallback((key: string) => {
    swipeableRefs.current.forEach((swipeable, refKey) => {
      if (refKey !== key) {
        swipeable.close();
      }
    });
  }, []);

  const closeSwipeable = useCallback((todo: Todo) => {
    swipeableRefs.current.get(getTodoKey(todo))?.close();
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingTodo(null);
    setModalType(null);
  }, []);

  const openEditModal = useCallback(
    (todo: Todo, type: EditModalType) => {
      closeSwipeable(todo);
      setEditingTodo(todo);
      setModalType(type);

      if (type === "schedule" || type === "deadline") {
        const existingTs = type === "schedule" ? todo.scheduled : todo.deadline;
        setSelectedDate(timestampToDate(existingTs) ?? new Date());
      }
    },
    [closeSwipeable],
  );

  const handleTodoPress = useCallback(
    (todo: Todo) => openEditModal(todo, "state"),
    [openEditModal],
  );
  const openScheduleModal = useCallback(
    (todo: Todo) => openEditModal(todo, "schedule"),
    [openEditModal],
  );
  const openDeadlineModal = useCallback(
    (todo: Todo) => openEditModal(todo, "deadline"),
    [openEditModal],
  );
  const openPriorityModal = useCallback(
    (todo: Todo) => openEditModal(todo, "priority"),
    [openEditModal],
  );

  // Schedule for a date immediately; optionally follow up with a time picker.
  const quickSchedule = useCallback(
    (todo: Todo, date: Date) => {
      closeSwipeable(todo);
      date.setSeconds(0, 0);
      scheduleTodo(todo, dateToTimestamp(date, false));
      if (quickScheduleIncludeTime) {
        setQuickScheduleDate(date);
        setEditingTodo(todo);
        setModalType("quickScheduleTime");
      }
    },
    [closeSwipeable, scheduleTodo, quickScheduleIncludeTime],
  );

  const scheduleToday = useCallback(
    (todo: Todo) => quickSchedule(todo, new Date()),
    [quickSchedule],
  );

  const scheduleTomorrow = useCallback(
    (todo: Todo) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      quickSchedule(todo, tomorrow);
    },
    [quickSchedule],
  );

  const quickComplete = useCallback(
    (todo: Todo, state: string, overrideDate?: Date) => {
      closeSwipeable(todo);
      changeTodoState(todo, state, {
        overrideDate,
        successSuffix: overrideDate
          ? ` (${formatLocalDate(overrideDate)})`
          : "",
        failureMessage: "Failed to complete",
        failureLog: "Failed to quick complete:",
      });
    },
    [closeSwipeable, changeTodoState],
  );

  const openDeleteConfirm = useCallback(
    (todo: Todo) => {
      closeSwipeable(todo);
      setDeleteConfirmTodo(todo);
    },
    [closeSwipeable],
  );

  // Modal callbacks

  const handleConfirmState = useCallback(
    (state: string, overrideDate: Date | null) => {
      if (!editingTodo) return;
      closeEditModal();
      changeTodoState(editingTodo, state, {
        overrideDate,
        successSuffix: overrideDate
          ? ` (as of ${formatLocalDate(overrideDate)})`
          : "",
        failureMessage: "Failed to change state",
        failureLog: "Failed to change todo state:",
      });
    },
    [editingTodo, closeEditModal, changeTodoState],
  );

  const handleSavePriority = useCallback(
    async (priority: string | null) => {
      if (!editingTodo) return;
      await updateTodo(editingTodo, { priority });
      closeEditModal();
    },
    [editingTodo, updateTodo, closeEditModal],
  );

  const handleConfirmDelete = useCallback(
    (todo: Todo) => {
      setDeleteConfirmTodo(null);
      deleteTodo(todo);
    },
    [deleteTodo],
  );

  const handleDismissDelete = useCallback(() => {
    setDeleteConfirmTodo(null);
  }, []);

  // Continue the schedule/deadline flow from the date step to the time step.
  const handleAdvanceToTimeStep = useCallback((date: Date) => {
    setSelectedDate(date);
    setModalType((prev) =>
      prev === "schedule" ? "scheduleTime" : "deadlineTime",
    );
  }, []);

  const contextValue = useMemo<TodoEditingContextValue>(
    () => ({
      completingIds: mutations.completingIds,
      updatingIds: mutations.updatingIds,
      deletingIds: mutations.deletingIds,
      registerSwipeable,
      closeOtherSwipeables,
      handleTodoPress,
      scheduleToday,
      scheduleTomorrow,
      openScheduleModal,
      openDeadlineModal,
      openPriorityModal,
      openDeleteConfirm,
      quickComplete,
    }),
    [
      mutations.completingIds,
      mutations.updatingIds,
      mutations.deletingIds,
      registerSwipeable,
      closeOtherSwipeables,
      handleTodoPress,
      scheduleToday,
      scheduleTomorrow,
      openScheduleModal,
      openDeadlineModal,
      openPriorityModal,
      openDeleteConfirm,
      quickComplete,
    ],
  );

  return (
    <TodoEditingContext.Provider value={contextValue}>
      {children}
      <TodoEditModals
        modalType={modalType}
        editingTodo={editingTodo}
        selectedDate={selectedDate}
        quickScheduleDate={quickScheduleDate}
        deleteConfirmTodo={deleteConfirmTodo}
        todoStates={todoStates}
        quickScheduleIncludeTime={quickScheduleIncludeTime}
        onClose={closeEditModal}
        onAdvanceToTimeStep={handleAdvanceToTimeStep}
        onUpdateTodo={updateTodo}
        onQuickSchedule={scheduleTodo}
        onConfirmState={handleConfirmState}
        onSavePriority={handleSavePriority}
        onConfirmDelete={handleConfirmDelete}
        onDismissDelete={handleDismissDelete}
      />
      <AppSnackbar />
    </TodoEditingContext.Provider>
  );
}
