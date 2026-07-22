import { PlatformDatePicker } from "@/components/PlatformDatePicker";
import { DeleteConfirmDialog } from "@/components/todoEditing/DeleteConfirmDialog";
import { PrioritySelectModal } from "@/components/todoEditing/PrioritySelectModal";
import { StateChangeModal } from "@/components/todoEditing/StateChangeModal";
import {
  Timestamp,
  Todo,
  TodoStatesResponse,
  TodoUpdates,
} from "@/services/api";
import { dateToTimestamp } from "@/utils/timestampConversion";
import React from "react";

export type EditModalType =
  | "schedule"
  | "deadline"
  | "scheduleTime"
  | "deadlineTime"
  | "priority"
  | "state"
  | "quickScheduleTime"
  | null;

const DEFAULT_STATES = ["TODO", "NEXT", "WAITING", "DONE"];

export interface TodoEditModalsProps {
  modalType: EditModalType;
  editingTodo: Todo | null;
  /** Base date for the schedule/deadline date+time flow. */
  selectedDate: Date;
  /** Base date for the quick-schedule (Today/Tomorrow) time step. */
  quickScheduleDate: Date;
  deleteConfirmTodo: Todo | null;
  todoStates?: TodoStatesResponse | null;
  /** When true, picking a date continues to a time-picking step. */
  quickScheduleIncludeTime: boolean;
  onClose: () => void;
  /** Move from the date step to the time step of the schedule/deadline flow. */
  onAdvanceToTimeStep: (date: Date) => void;
  onUpdateTodo: (todo: Todo, updates: TodoUpdates) => void;
  onQuickSchedule: (todo: Todo, timestamp: Timestamp) => void;
  onConfirmState: (state: string, overrideDate: Date | null) => void;
  onSavePriority: (priority: string | null) => void;
  onConfirmDelete: (todo: Todo) => void;
  onDismissDelete: () => void;
}

/**
 * All modals/pickers for the todo editing flows. Rendered once by
 * TodoEditingProvider; which one is visible is driven by `modalType`.
 */
export function TodoEditModals({
  modalType,
  editingTodo,
  selectedDate,
  quickScheduleDate,
  deleteConfirmTodo,
  todoStates,
  quickScheduleIncludeTime,
  onClose,
  onAdvanceToTimeStep,
  onUpdateTodo,
  onQuickSchedule,
  onConfirmState,
  onSavePriority,
  onConfirmDelete,
  onDismissDelete,
}: TodoEditModalsProps) {
  const allStates = todoStates
    ? [...todoStates.active, ...todoStates.done]
    : DEFAULT_STATES;

  const isDateModal = modalType === "schedule" || modalType === "deadline";
  const isTimeModal =
    modalType === "scheduleTime" || modalType === "deadlineTime";

  // Date picked for schedule/deadline: either continue to the time step or
  // save the date-only timestamp immediately.
  const handleDatePicked = (date: Date) => {
    if (!editingTodo || !isDateModal) return;
    if (quickScheduleIncludeTime) {
      onAdvanceToTimeStep(date);
    } else {
      onClose();
      const fieldName = modalType === "schedule" ? "scheduled" : "deadline";
      onUpdateTodo(editingTodo, { [fieldName]: dateToTimestamp(date, false) });
    }
  };

  // Time picked for schedule/deadline: save date + time.
  const handleTimePicked = (date: Date) => {
    if (!editingTodo || !isTimeModal) return;
    onClose();
    const fieldName = modalType === "scheduleTime" ? "scheduled" : "deadline";
    onUpdateTodo(editingTodo, { [fieldName]: dateToTimestamp(date, true) });
  };

  // Time picked after a quick Today/Tomorrow schedule: re-schedule with time.
  const handleQuickTimePicked = (date: Date) => {
    if (!editingTodo) return;
    onClose();
    onQuickSchedule(editingTodo, dateToTimestamp(date, true));
  };

  return (
    <>
      {/* Schedule/Deadline date step */}
      <PlatformDatePicker
        mode="date"
        visible={isDateModal}
        value={selectedDate}
        onChange={handleDatePicked}
        onDismiss={onClose}
      />

      {/* Schedule/Deadline time step */}
      <PlatformDatePicker
        mode="time"
        visible={isTimeModal}
        value={selectedDate}
        onChange={handleTimePicked}
        onDismiss={onClose}
      />

      {/* Quick Schedule (Today/Tomorrow) time step */}
      <PlatformDatePicker
        mode="time"
        visible={modalType === "quickScheduleTime"}
        value={quickScheduleDate}
        onChange={handleQuickTimePicked}
        onDismiss={onClose}
      />

      <PrioritySelectModal
        visible={modalType === "priority"}
        initialPriority={editingTodo?.priority || ""}
        onDismiss={onClose}
        onSave={onSavePriority}
      />

      <StateChangeModal
        visible={modalType === "state"}
        todo={editingTodo}
        states={allStates}
        onDismiss={onClose}
        onConfirm={onConfirmState}
      />

      <DeleteConfirmDialog
        todo={deleteConfirmTodo}
        onDismiss={onDismissDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
