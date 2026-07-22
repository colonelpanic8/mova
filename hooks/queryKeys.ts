import { useAuth } from "@/context/AuthContext";
import { buildConfigIdentityKey } from "@/services/configMetadata";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Every query key starts with the server identity (normalized url + username,
 * see buildConfigIdentityKey) so data can never leak between servers: keys
 * for server A simply never match queries for server B.
 */
export function buildServerIdentity(
  apiUrl: string | null | undefined,
  username: string | null | undefined,
): string | null {
  return apiUrl && username ? buildConfigIdentityKey(apiUrl, username) : null;
}

/**
 * Placeholder identity used to build keys while signed out. Queries built
 * with it are always disabled (and never persisted), so it only exists to
 * keep key construction unconditional.
 */
export const SIGNED_OUT_IDENTITY = "signed-out";

export interface AgendaViewKeyParams {
  mode: "day" | "multiday";
  dateString: string;
  /** Normalized to 1 for day mode so day keys don't fragment on range. */
  rangeLength: number;
  includeCompleted: boolean;
}

export const queryKeys = {
  /** All agenda views for one server. */
  agenda: (identity: string) => [identity, "agenda"] as const,
  /** One agenda view (what the agenda screen is looking at). */
  agendaView: (identity: string, params: AgendaViewKeyParams) =>
    [
      identity,
      "agenda",
      params.mode,
      params.dateString,
      params.rangeLength,
      params.includeCompleted,
    ] as const,
  /** get-all-todos (search screen, habits listing). */
  todos: (identity: string) => [identity, "todos"] as const,
  todoStates: (identity: string) => [identity, "todo-states"] as const,
  /** All habit-status windows for one server. */
  habitStatuses: (identity: string) => [identity, "habit-statuses"] as const,
  habitStatusWindow: (identity: string, preceding: number, following: number) =>
    [identity, "habit-statuses", preceding, following] as const,
  /** Custom view list; viewEntries extends it so one prefix covers both. */
  views: (identity: string) => [identity, "views"] as const,
  viewEntries: (identity: string, viewKey: string) =>
    [identity, "views", viewKey] as const,
  /** Templates / filter options / todo states / habit config bundle. */
  metadata: (identity: string) => [identity, "metadata"] as const,
};

/**
 * Invalidate everything a todo/capture mutation can affect for one server:
 * agenda views, the all-todos listing, habit statuses, and custom view
 * results. Config-ish data (metadata, todo states) is left alone — it changes
 * via server config, which the config-hash observer handles.
 */
export function invalidateServerData(
  queryClient: QueryClient,
  identity: string,
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.agenda(identity) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.todos(identity) }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.habitStatuses(identity),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.views(identity) }),
  ]).then(() => undefined);
}

/**
 * Hook form of invalidateServerData bound to the active server. This is the
 * replacement for the old MutationContext triggerRefresh(): call it after any
 * mutation that changes org data on the server.
 */
export function useServerDataInvalidation(): () => void {
  const queryClient = useQueryClient();
  const { apiUrl, username } = useAuth();

  return useCallback(() => {
    const identity = buildServerIdentity(apiUrl, username);
    if (!identity) return;
    void invalidateServerData(queryClient, identity);
  }, [queryClient, apiUrl, username]);
}
