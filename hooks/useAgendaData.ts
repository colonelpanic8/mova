import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import {
  buildServerIdentity,
  queryKeys,
  SIGNED_OUT_IDENTITY,
} from "@/hooks/queryKeys";
import {
  ApiError,
  MultiDayAgendaResponse,
  SingleDayAgendaResponse,
  Todo,
} from "@/services/api";
import { formatLocalDate } from "@/utils/dateFormatting";
import { getTodoKey } from "@/utils/todoKey";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

export interface AgendaDataParams {
  mode: "day" | "multiday";
  date: Date;
  rangeLength: number;
  includeCompleted: boolean;
}

export interface UseAgendaDataResult {
  /** Single-day payload; null unless mode is "day" and data is available. */
  agenda: SingleDayAgendaResponse | null;
  /** Multi-day payload; null unless mode is "multiday" and data is available. */
  multiDayData: MultiDayAgendaResponse | null;
  /** True while the current view has no data yet (spinner state). */
  isLoading: boolean;
  /** Human-facing error for the current view, or null. */
  error: string | null;
  /**
   * When the displayed data was fetched (ms epoch; 0 if never). Drives the
   * "showing data from N minutes ago" stale banner after a failed refresh.
   */
  dataUpdatedAt: number;
  refetch: () => Promise<unknown>;
  /**
   * Apply an optimistic in-place update to the current view's cached data
   * (e.g. after completing or rescheduling a todo). In day mode, an item
   * rescheduled to a different date is removed from the view.
   */
  updateTodoInView: (todo: Todo, updates: Partial<Todo>) => void;
}

/** End of a multi-day range: start + rangeLength - 1. */
function getRangeEnd(startDate: Date, rangeLength: number): Date {
  const result = new Date(startDate);
  result.setDate(result.getDate() + rangeLength - 1);
  return result;
}

/**
 * The agenda screen's server state: one query per view (mode + date + range +
 * completed-visibility), keyed by server identity. The raw payload is always
 * the multi-day response — the single-day view is derived from it — because
 * even single-day fetches use the multi-day endpoint to get prospective habit
 * scheduling.
 *
 * Offline-first behavior comes from the persisted query cache: a cached view
 * renders instantly (isLoading false) while a background refetch runs; if the
 * refetch fails the cached data stays on screen with `error` set alongside
 * it, and `dataUpdatedAt` reports the age of what's shown.
 */
export function useAgendaData(params: AgendaDataParams): UseAgendaDataResult {
  const api = useApi();
  const { apiUrl, username } = useAuth();
  const queryClient = useQueryClient();

  const { mode, date, rangeLength, includeCompleted } = params;
  const identity = buildServerIdentity(apiUrl, username);
  const dateString = formatLocalDate(date);
  const normalizedRangeLength = mode === "multiday" ? rangeLength : 1;

  const queryKey = useMemo(
    () =>
      queryKeys.agendaView(identity ?? SIGNED_OUT_IDENTITY, {
        mode,
        dateString,
        rangeLength: normalizedRangeLength,
        includeCompleted,
      }),
    [identity, mode, dateString, normalizedRangeLength, includeCompleted],
  );

  const query = useQuery({
    queryKey,
    enabled: Boolean(api && identity),
    queryFn: async (): Promise<MultiDayAgendaResponse> => {
      const todayString = formatLocalDate(new Date());
      if (mode === "multiday") {
        return api!.getAgenda(
          "week",
          dateString,
          true,
          includeCompleted,
          formatLocalDate(getRangeEnd(date, normalizedRangeLength)),
          todayString,
          "today", // Show overdue tasks only on today, not every future day
        );
      }
      // Use the multi-day endpoint even for a single day to get prospective
      // habit scheduling (org-window-habit future required intervals). Some
      // servers (e.g. without org-window-habit-mode) reject multi-day
      // requests outright, so fall back to the plain single-day endpoint,
      // which only lacks prospective habit entries.
      try {
        return await api!.getAgenda(
          "week",
          dateString,
          dateString <= todayString,
          includeCompleted,
          dateString,
        );
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        const single = await api!.getAgenda(
          "day",
          dateString,
          dateString <= todayString,
          includeCompleted,
        );
        return {
          span: "custom",
          startDate: dateString,
          endDate: dateString,
          today: todayString,
          days: { [single.date ?? dateString]: single.entries },
        };
      }
    },
  });

  const data = query.data ?? null;

  const agenda = useMemo<SingleDayAgendaResponse | null>(() => {
    if (mode !== "day" || !data) return null;
    return {
      span: "day",
      date: dateString,
      entries: data.days[dateString] ?? [],
    };
  }, [mode, data, dateString]);

  const updateTodoInView = useCallback(
    (todo: Todo, updates: Partial<Todo>) => {
      queryClient.setQueryData<MultiDayAgendaResponse>(queryKey, (prev) => {
        if (!prev) return prev;
        const targetKey = getTodoKey(todo);
        const newDays: MultiDayAgendaResponse["days"] = {};
        for (const [dayString, entries] of Object.entries(prev.days)) {
          // In day mode, rescheduling to another date removes the item from
          // the current view immediately.
          const movedAway =
            mode === "day" &&
            updates.scheduled !== undefined &&
            updates.scheduled?.date != null &&
            updates.scheduled.date !== dayString;
          newDays[dayString] = movedAway
            ? entries.filter((entry) => getTodoKey(entry) !== targetKey)
            : entries.map((entry) =>
                getTodoKey(entry) === targetKey
                  ? { ...entry, ...updates }
                  : entry,
              );
        }
        return { ...prev, days: newDays };
      });
    },
    [queryClient, queryKey, mode],
  );

  return {
    agenda,
    multiDayData: mode === "multiday" ? data : null,
    // isPending: no data (fresh or persisted) and no error yet — exactly the
    // "nothing to render, show the spinner" state.
    isLoading: query.isPending,
    error: query.isError
      ? mode === "multiday"
        ? "Failed to load multi-day agenda"
        : "Failed to load agenda"
      : null,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
    updateTodoInView,
  };
}
