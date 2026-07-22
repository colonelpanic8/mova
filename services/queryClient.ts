import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";

/** AsyncStorage key holding the dehydrated query cache. */
export const QUERY_CACHE_STORAGE_KEY = "mova_query_cache_v1";

/**
 * Cache buster for the persisted query cache. Bump whenever the shape of any
 * persisted query's data changes so stale entries are discarded on launch.
 */
export const QUERY_CACHE_BUSTER = "1";

/**
 * How long persisted queries stay usable. Also used as gcTime so in-memory
 * entries live at least as long as their persisted counterparts (the
 * persister requires gcTime >= maxAge).
 */
export const QUERY_PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Query-key domains (the segment after the server identity) that are worth
 * persisting for offline launches: the agenda itself plus the lookups needed
 * to render it (todo states, habit statuses) and the capture/filter metadata.
 * Volatile listings (search todos, custom views) are cheap to refetch and are
 * intentionally not persisted.
 */
const PERSISTED_QUERY_DOMAINS = new Set([
  "agenda",
  "metadata",
  "habit-statuses",
  "todo-states",
]);

export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  return (
    typeof queryKey[1] === "string" && PERSISTED_QUERY_DOMAINS.has(queryKey[1])
  );
}

/**
 * QueryClient defaults for this app:
 * - staleTime 30s: agenda-ish data is refetched at most every 30s per view.
 * - gcTime = persistence maxAge so restored entries aren't collected early.
 * - retry: false because OrgAgendaApi already retries transient failures
 *   internally (maxAttempts/backoff); stacking query retries on top would
 *   multiply the wait before an error surfaces.
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: QUERY_PERSIST_MAX_AGE_MS,
        retry: false,
      },
    },
  });
}

export function createAppPersister() {
  return createAsyncStoragePersister({
    storage: AsyncStorage,
    key: QUERY_CACHE_STORAGE_KEY,
    throttleTime: 1_000,
  });
}
