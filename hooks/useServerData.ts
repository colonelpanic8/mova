import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import {
  buildServerIdentity,
  queryKeys,
  SIGNED_OUT_IDENTITY,
} from "@/hooks/queryKeys";
import { HabitStatus, TodoStatesResponse } from "@/services/api";
import { useQuery, UseQueryResult } from "@tanstack/react-query";

/**
 * Todo states (active/done keywords) for the current server. Shared across
 * screens; persisted so the agenda can classify entries offline.
 */
export function useTodoStates(): UseQueryResult<TodoStatesResponse> {
  const api = useApi();
  const { apiUrl, username } = useAuth();
  const identity = buildServerIdentity(apiUrl, username);

  return useQuery({
    queryKey: queryKeys.todoStates(identity ?? SIGNED_OUT_IDENTITY),
    enabled: Boolean(api && identity),
    queryFn: () => api!.getTodoStates(),
  });
}

/**
 * Habit statuses for the current server over a preceding/following window.
 * Shared by the agenda and habits screens; a failed refetch keeps the last
 * good statuses (the query retains data alongside the error).
 */
export function useHabitStatuses(
  preceding: number,
  following: number,
  options: { enabled?: boolean } = {},
): UseQueryResult<HabitStatus[]> {
  const api = useApi();
  const { apiUrl, username } = useAuth();
  const identity = buildServerIdentity(apiUrl, username);

  return useQuery({
    queryKey: queryKeys.habitStatusWindow(
      identity ?? SIGNED_OUT_IDENTITY,
      preceding,
      following,
    ),
    enabled: Boolean(api && identity) && (options.enabled ?? true),
    queryFn: async (): Promise<HabitStatus[]> => {
      const response = await api!.getAllHabitStatuses(preceding, following);
      if (response?.status === "ok" && response.habits) {
        return response.habits;
      }
      throw new Error("Failed to load habit statuses");
    },
  });
}
