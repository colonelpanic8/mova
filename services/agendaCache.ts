import type {
  HabitStatus,
  MultiDayAgendaResponse,
  SingleDayAgendaResponse,
  TodoStatesResponse,
} from "@/services/api";
import { buildConfigIdentityKey } from "@/services/configMetadata";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Bump the version suffix whenever the cached shape changes so stale entries
// are invalidated cleanly (old keys simply stop being read).
const STORAGE_PREFIX = "mova_agenda_cache_v1";

// Maximum number of cached views kept per server identity; older entries are
// pruned (by fetchedAt) after each save so the cache can't grow unboundedly.
export const MAX_CACHED_AGENDA_VIEWS = 15;

/**
 * Snapshot of everything the agenda screen needs to render a view offline:
 * the agenda payload (single- or multi-day), todo states, habit statuses, and
 * when the data was fetched.
 */
export interface CachedAgendaData {
  agenda: SingleDayAgendaResponse | null;
  multiDayData: MultiDayAgendaResponse | null;
  todoStates: TodoStatesResponse | null;
  habitStatuses: HabitStatus[] | null;
  fetchedAt: string;
}

export type AgendaViewKeyParams =
  | { mode: "day"; dateString: string; includeCompleted: boolean }
  | {
      mode: "multiday";
      dateString: string;
      rangeLength: number;
      includeCompleted: boolean;
    };

/**
 * Build a stable key describing one agenda "view" (what the screen is looking
 * at), so each view caches independently.
 */
export function buildAgendaViewKey(params: AgendaViewKeyParams): string {
  const completedKey = params.includeCompleted ? "all" : "active";
  if (params.mode === "multiday") {
    return `multiday:${params.dateString}:${params.rangeLength}:${completedKey}`;
  }
  return `day:${params.dateString}:${completedKey}`;
}

function buildIdentityPrefix(apiUrl: string, username: string): string {
  return `${STORAGE_PREFIX}:${buildConfigIdentityKey(apiUrl, username)}:`;
}

export function buildAgendaCacheKey(
  apiUrl: string,
  username: string,
  viewKey: string,
): string {
  return `${buildIdentityPrefix(apiUrl, username)}${viewKey}`;
}

export async function getCachedAgenda(
  apiUrl: string,
  username: string,
  viewKey: string,
): Promise<CachedAgendaData | null> {
  try {
    const raw = await AsyncStorage.getItem(
      buildAgendaCacheKey(apiUrl, username, viewKey),
    );
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedAgendaData>;
    if (typeof parsed.fetchedAt !== "string") {
      return null;
    }
    if (!parsed.agenda && !parsed.multiDayData) {
      return null;
    }

    return {
      agenda: parsed.agenda ?? null,
      multiDayData: parsed.multiDayData ?? null,
      todoStates: parsed.todoStates ?? null,
      habitStatuses: Array.isArray(parsed.habitStatuses)
        ? parsed.habitStatuses
        : null,
      fetchedAt: parsed.fetchedAt,
    };
  } catch (error) {
    console.warn("Failed to read cached agenda:", error);
    return null;
  }
}

export async function saveCachedAgenda(
  apiUrl: string,
  username: string,
  viewKey: string,
  entry: CachedAgendaData,
): Promise<void> {
  try {
    // The todo-states / habit-statuses fetches can fail independently of the
    // agenda fetch (they're `.catch(() => null)`-guarded upstream). Don't let
    // a null overwrite previously-good cached values: merge-preserve them.
    let toStore = entry;
    if (entry.todoStates === null || entry.habitStatuses === null) {
      const prior = await getCachedAgenda(apiUrl, username, viewKey);
      if (prior) {
        toStore = {
          ...entry,
          todoStates: entry.todoStates ?? prior.todoStates,
          habitStatuses: entry.habitStatuses ?? prior.habitStatuses,
        };
      }
    }
    await AsyncStorage.setItem(
      buildAgendaCacheKey(apiUrl, username, viewKey),
      JSON.stringify(toStore),
    );
  } catch (error) {
    console.warn("Failed to save cached agenda:", error);
  }
  await pruneCachedAgendas(apiUrl, username);
}

/**
 * Evict the oldest cached views (by fetchedAt) for one server identity when
 * the number of cached views exceeds MAX_CACHED_AGENDA_VIEWS. Entries that
 * fail to parse are treated as oldest and evicted first. All errors are
 * swallowed — pruning is best-effort housekeeping.
 */
export async function pruneCachedAgendas(
  apiUrl: string,
  username: string,
): Promise<void> {
  try {
    const prefix = buildIdentityPrefix(apiUrl, username);
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((key) => key.startsWith(prefix));
    if (cacheKeys.length <= MAX_CACHED_AGENDA_VIEWS) {
      return;
    }

    const pairs = await AsyncStorage.multiGet(cacheKeys);
    const fetchedTimeByKey = new Map<string, number>();
    for (const [key, raw] of pairs) {
      // Unreadable/unparseable entries sort as oldest so they go first.
      let fetchedTime = 0;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<CachedAgendaData>;
          const time = Date.parse(parsed.fetchedAt ?? "");
          if (Number.isFinite(time)) {
            fetchedTime = time;
          }
        } catch {
          // Treat as oldest.
        }
      }
      fetchedTimeByKey.set(key, fetchedTime);
    }

    const oldestFirst = [...cacheKeys].sort(
      (a, b) => (fetchedTimeByKey.get(a) ?? 0) - (fetchedTimeByKey.get(b) ?? 0),
    );
    const toRemove = oldestFirst.slice(
      0,
      cacheKeys.length - MAX_CACHED_AGENDA_VIEWS,
    );
    await AsyncStorage.multiRemove(toRemove);
  } catch (error) {
    console.warn("Failed to prune agenda cache:", error);
  }
}

export async function clearCachedAgenda(
  apiUrl: string,
  username: string,
  viewKey: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(
      buildAgendaCacheKey(apiUrl, username, viewKey),
    );
  } catch (error) {
    console.warn("Failed to clear cached agenda:", error);
  }
}
