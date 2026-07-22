import { useApi } from "@/context/ApiContext";
import { useMutation } from "@/context/MutationContext";
import { useSettings } from "@/context/SettingsContext";
import { useSnackbar } from "@/context/SnackbarContext";
import { OrgAgendaApi, Timestamp, Todo, TodoUpdates } from "@/services/api";
import { completeTodoWithNotificationSync } from "@/services/todoCompletion";
import { getTodoKey } from "@/utils/todoKey";
import { Dispatch, SetStateAction, useCallback, useState } from "react";

export interface UseTodoMutationsOptions {
  onTodoUpdated?: (todo: Todo, updates: Partial<Todo>) => void;
}

export interface ChangeTodoStateOptions {
  /** Place the completion on this date instead of today. */
  overrideDate?: Date | null;
  /** Appended to the success snackbar message (e.g. " (as of 2026-07-22)"). */
  successSuffix?: string;
  /** Snackbar message when the mutation fails. */
  failureMessage: string;
  /** console.error prefix when the mutation throws. */
  failureLog: string;
}

export interface UseTodoMutationsResult {
  completingIds: Set<string>;
  updatingIds: Set<string>;
  deletingIds: Set<string>;
  scheduleTodo: (todo: Todo, timestamp: Timestamp) => Promise<void>;
  updateTodo: (todo: Todo, updates: TodoUpdates) => Promise<void>;
  changeTodoState: (
    todo: Todo,
    state: string,
    options: ChangeTodoStateOptions,
  ) => Promise<void>;
  deleteTodo: (todo: Todo) => Promise<void>;
}

type IdSetSetter = Dispatch<SetStateAction<Set<string>>>;

interface TodoMutation {
  /** The mutation itself; snackbar/refresh calls for its outcomes included. */
  run: (api: OrgAgendaApi) => Promise<void>;
  /** console.error prefix if `run` throws. */
  errorLog: string;
  /** Snackbar message if `run` throws. */
  errorMessage: string;
}

/**
 * Todo mutations with shared loading-set bookkeeping and snackbar reporting.
 * Each operation tracks its todo's key in the appropriate loading set while
 * in flight and reports failures via the app snackbar.
 */
export function useTodoMutations(
  options: UseTodoMutationsOptions = {},
): UseTodoMutationsResult {
  const { onTodoUpdated } = options;
  const api = useApi();
  const { triggerRefresh } = useMutation();
  const { useClientCompletionTime } = useSettings();
  const { showSnackbar } = useSnackbar();

  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const runTodoMutation = useCallback(
    async (todo: Todo, setIds: IdSetSetter, mutation: TodoMutation) => {
      if (!api) return;
      const key = getTodoKey(todo);
      setIds((prev) => new Set(prev).add(key));

      try {
        await mutation.run(api);
      } catch (err) {
        console.error(mutation.errorLog, err);
        showSnackbar(mutation.errorMessage, { isError: true });
      } finally {
        setIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [api, showSnackbar],
  );

  const scheduleTodo = useCallback(
    (todo: Todo, timestamp: Timestamp) =>
      runTodoMutation(todo, setUpdatingIds, {
        errorLog: "Failed to schedule todo:",
        errorMessage: "Failed to schedule todo",
        run: async (client) => {
          const result = await client.updateTodo(todo, {
            scheduled: timestamp,
          });
          if (result.status === "updated") {
            showSnackbar(`Scheduled: ${todo.title}`);
            onTodoUpdated?.(todo, { scheduled: timestamp });
            triggerRefresh();
          } else {
            showSnackbar(result.message || "Failed to schedule", {
              isError: true,
            });
          }
        },
      }),
    [runTodoMutation, showSnackbar, onTodoUpdated, triggerRefresh],
  );

  const updateTodo = useCallback(
    (todo: Todo, updates: TodoUpdates) =>
      runTodoMutation(todo, setUpdatingIds, {
        errorLog: "Failed to update todo:",
        errorMessage: "Failed to update todo",
        run: async (client) => {
          const result = await client.updateTodo(todo, updates);
          if (result.status === "updated") {
            showSnackbar(`Updated: ${todo.title}`);
            onTodoUpdated?.(todo, updates);
            triggerRefresh();
          } else {
            showSnackbar(result.message || "Failed to update", {
              isError: true,
            });
          }
        },
      }),
    [runTodoMutation, showSnackbar, onTodoUpdated, triggerRefresh],
  );

  const changeTodoState = useCallback(
    (todo: Todo, state: string, stateOptions: ChangeTodoStateOptions) => {
      const {
        overrideDate,
        successSuffix = "",
        failureMessage,
        failureLog,
      } = stateOptions;
      return runTodoMutation(todo, setCompletingIds, {
        errorLog: failureLog,
        errorMessage: failureMessage,
        run: async (client) => {
          const result = await completeTodoWithNotificationSync(
            client,
            todo,
            state,
            { overrideDate, useClientCompletionTime },
          );
          if (result.status === "completed") {
            showSnackbar(
              `${todo.title}: ${result.oldState} → ${result.newState}${successSuffix}`,
            );
            onTodoUpdated?.(todo, { todo: result.newState || state });
            triggerRefresh();
          } else {
            showSnackbar(result.message || failureMessage, { isError: true });
          }
        },
      });
    },
    [
      runTodoMutation,
      showSnackbar,
      onTodoUpdated,
      triggerRefresh,
      useClientCompletionTime,
    ],
  );

  const deleteTodo = useCallback(
    (todo: Todo) =>
      runTodoMutation(todo, setDeletingIds, {
        errorLog: "Failed to delete todo:",
        errorMessage: "Failed to delete todo",
        run: async (client) => {
          const result = await client.deleteTodo(todo);
          if (result.deleted) {
            showSnackbar(`Deleted: ${todo.title}`);
            triggerRefresh();
          } else {
            showSnackbar(result.message || "Failed to delete", {
              isError: true,
            });
          }
        },
      }),
    [runTodoMutation, showSnackbar, triggerRefresh],
  );

  return {
    completingIds,
    updatingIds,
    deletingIds,
    scheduleTodo,
    updateTodo,
    changeTodoState,
    deleteTodo,
  };
}
