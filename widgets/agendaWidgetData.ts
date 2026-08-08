import {
  AgendaEntry,
  AgendaResponse,
  createApiClient,
  Todo,
} from "@/services/api";
import {
  getDefaultDoneState,
  getUseClientCompletionTime,
} from "@/services/settings";
import { formatLocalDate, formatLocalDateTime } from "@/utils/dateFormatting";
import { getTodoKey } from "@/utils/todoKey";
import { NativeModules } from "react-native";
import { getWidgetCredentials } from "./storage";

const { SharedStorage } = NativeModules;

/** Where the last successful fetch is parked so a redraw can paint instantly. */
const CACHE_KEY = "mova_agenda_widget_cache";

/**
 * A home-screen widget is a bitmap, not a scrollable data source we can page:
 * every row is rendered up front, so the list is capped at what someone would
 * plausibly scroll through on a launcher.
 */
export const MAX_AGENDA_WIDGET_ITEMS = 25;

/** Fallback done state when the server hasn't told us its keywords yet. */
const FALLBACK_DONE_STATE = "DONE";

/** A single completable row on the widget. */
export interface AgendaWidgetItem {
  /** Stable identity across refetches (org id, else file:pos:title). */
  key: string;
  title: string;
  state: string;
  /** Scheduled/deadline time of day, when the entry has one. */
  timeLabel: string | null;
  /** Display label such as "S 2026-08-08 09:00 · D 2026-08-09". */
  timestampLabel: string | null;
  category: string | null;
  priority: string | null;
  isOverdue: boolean;
  isHabit: boolean;
  /** Habits stay listed after being logged; one-off items disappear. */
  completedToday: boolean;
  id: string | null;
  file: string | null;
  pos: number | null;
}

export type AgendaWidgetStatus = "ok" | "unauthenticated" | "error";

export interface AgendaWidgetData {
  status: AgendaWidgetStatus;
  items: AgendaWidgetItem[];
  habits: AgendaWidgetItem[];
  /** Human-facing explanation when status isn't "ok". */
  message?: string;
  /** When `items` was fetched (ms epoch), for stale-data reporting. */
  fetchedAt: number;
}

/**
 * The subset of an item that survives the round trip through a widget click
 * intent. Android bundles the click data and JSON-decodes it on the way back,
 * so every field is a string to avoid numbers returning as doubles.
 */
export type AgendaWidgetItemRef = {
  key?: string;
  id?: string;
  file?: string;
  pos?: string;
  title?: string;
};

export function buildItemRef(item: AgendaWidgetItem): AgendaWidgetItemRef {
  return {
    key: item.key,
    ...(item.id ? { id: item.id } : {}),
    ...(item.file ? { file: item.file } : {}),
    ...(item.pos != null ? { pos: String(item.pos) } : {}),
    title: item.title,
  };
}

/** Prefer a scheduled time-of-day, falling back to a deadline time. */
function timeLabelOf(entry: AgendaEntry): string | null {
  return entry.scheduled?.time || entry.deadline?.time || null;
}

function timestampLabelOf(entry: AgendaEntry): string | null {
  const label = (
    kind: "S" | "D",
    timestamp: NonNullable<AgendaEntry["scheduled"]>,
  ) => `${kind} ${timestamp.date}${timestamp.time ? ` ${timestamp.time}` : ""}`;
  const labels = [
    entry.scheduled ? label("S", entry.scheduled) : null,
    entry.deadline ? label("D", entry.deadline) : null,
  ].filter((value): value is string => value !== null);
  return labels.length > 0 ? labels.join(" · ") : null;
}

/**
 * Whether an entry is late. Servers that classify entries say so in
 * dateRelevance, but plain single-day agendas often omit it, so fall back to
 * comparing the entry's own dates against today — the same rule the agenda
 * screen uses to paint a timestamp red.
 */
function isOverdueEntry(entry: AgendaEntry, today: string): boolean {
  if (entry.dateRelevance === "overdue") return true;
  if (entry.dateRelevance || entry.completedAt) return false;
  return [entry.scheduled?.date, entry.deadline?.date].some(
    (date) => date != null && date < today,
  );
}

function toWidgetItem(
  entry: AgendaEntry,
  today: string,
  doneStates: string[],
): AgendaWidgetItem | null {
  const title = entry.title || entry.agendaLine;
  if (!title) return null;

  // Without an identifier the /complete endpoint can't locate the item, so a
  // row for it would be a button that does nothing.
  if (!entry.id && (!entry.file || entry.pos == null)) return null;

  const isHabit = Boolean(entry.isWindowHabit);
  // Some servers classify entries (dateRelevance/completedAt); others just
  // report the raw keyword, so an item finished elsewhere is only recognizable
  // by its state. Check all three or finished work lingers on the widget.
  const completedToday =
    entry.dateRelevance === "completed" ||
    Boolean(entry.completedAt) ||
    doneStates.includes(entry.todo) ||
    Boolean(entry.habitCompletedOnQueryDate);

  return {
    key: getTodoKey(entry),
    title,
    state: entry.todo || "",
    timeLabel: timeLabelOf(entry),
    timestampLabel: timestampLabelOf(entry),
    category: entry.effectiveCategory || entry.category || null,
    priority: entry.priority || null,
    isOverdue: isOverdueEntry(entry, today),
    isHabit,
    completedToday,
    id: entry.id,
    file: entry.file,
    pos: entry.pos,
  };
}

function flattenEntries(response: AgendaResponse): AgendaEntry[] {
  if (response.span === "day") {
    return response.entries ?? [];
  }
  const days = response.days ?? {};
  return Object.keys(days)
    .sort()
    .flatMap((date) => days[date] ?? []);
}

function dedupeItems(items: AgendaWidgetItem[]): AgendaWidgetItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function compareItems(a: AgendaWidgetItem, b: AgendaWidgetItem): number {
  if (a.completedToday !== b.completedToday) return a.completedToday ? 1 : -1;
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  if ((a.timeLabel === null) !== (b.timeLabel === null)) {
    return a.timeLabel === null ? 1 : -1;
  }
  return (a.timeLabel ?? "").localeCompare(b.timeLabel ?? "");
}

/**
 * Reduce an agenda response to the outstanding work worth showing on a home
 * screen. Finished one-off items are dropped (there is nothing left to tap);
 * habits are kept, flagged as done for the day, so a recurring item stays
 * glanceable after being logged.
 */
export function selectAgendaWidgetItems(
  response: AgendaResponse,
  options: {
    includeHabits?: boolean;
    today?: string;
    doneStates?: string[];
  } = {},
): AgendaWidgetItem[] {
  const {
    includeHabits = false,
    today = formatLocalDate(new Date()),
    doneStates = [FALLBACK_DONE_STATE],
  } = options;

  const items = flattenEntries(response)
    .map((entry) => toWidgetItem(entry, today, doneStates))
    .filter((item): item is AgendaWidgetItem => item !== null)
    .filter((item) => (item.isHabit ? includeHabits : !item.completedToday));

  // Overdue items are echoed onto today by the server, so the same entry can
  // arrive twice; keep the first occurrence.
  // Outstanding work first: overdue, then timed (in clock order), then the
  // rest. Habits already logged today sink to the bottom.
  const sorted = dedupeItems(items).sort(compareItems);

  return sorted.slice(0, MAX_AGENDA_WIDGET_ITEMS);
}

export function selectAgendaWidgetHabits(
  response: AgendaResponse,
  options: {
    today?: string;
    doneStates?: string[];
  } = {},
): AgendaWidgetItem[] {
  const {
    today = formatLocalDate(new Date()),
    doneStates = [FALLBACK_DONE_STATE],
  } = options;

  const habits = flattenEntries(response)
    .map((entry) => toWidgetItem(entry, today, doneStates))
    .filter((item): item is AgendaWidgetItem => item?.isHabit === true);

  return dedupeItems(habits)
    .sort(compareItems)
    .slice(0, MAX_AGENDA_WIDGET_ITEMS);
}

async function readCache(): Promise<AgendaWidgetData | null> {
  if (!SharedStorage) return null;
  try {
    const raw = await SharedStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgendaWidgetData;
    if (!Array.isArray(parsed.items)) return null;
    const hasHabitCache = Array.isArray(parsed.habits);
    return {
      ...parsed,
      habits: hasHabitCache ? parsed.habits : [],
      fetchedAt: hasHabitCache ? parsed.fetchedAt : 0,
    };
  } catch {
    return null;
  }
}

async function writeCache(data: AgendaWidgetData): Promise<void> {
  if (!SharedStorage) return;
  try {
    await SharedStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("[AgendaWidget] Failed to cache agenda:", error);
  }
}

/**
 * The last successfully fetched agenda, if any. Drawing this before the
 * network call keeps the widget from blanking out on every refresh.
 */
export async function readAgendaWidgetCache(): Promise<AgendaWidgetData | null> {
  return readCache();
}

/** Drop an item from the cache so an optimistic redraw doesn't show it again. */
export async function removeCachedAgendaItem(key: string): Promise<void> {
  const cached = await readCache();
  if (!cached) return;
  await writeCache({
    ...cached,
    items: cached.items.filter((item) => item.key !== key),
  });
}

/**
 * Fetch today's agenda (including overdue items) for the widget. Failures fall
 * back to the cached list so a flaky network shows stale data rather than an
 * empty widget.
 */
export async function loadAgendaWidgetData(): Promise<AgendaWidgetData> {
  const { apiUrl, username, password } = await getWidgetCredentials();
  if (!apiUrl || !username || !password) {
    return {
      status: "unauthenticated",
      items: [],
      habits: [],
      fetchedAt: Date.now(),
    };
  }

  try {
    const api = createApiClient(apiUrl, username, password);
    const [response, doneStates] = await Promise.all([
      api.getAgenda("day", undefined, true),
      getDoneStates(api),
    ]);
    const data: AgendaWidgetData = {
      status: "ok",
      items: selectAgendaWidgetItems(response, { doneStates }),
      habits: selectAgendaWidgetHabits(response, { doneStates }),
      fetchedAt: Date.now(),
    };
    await writeCache(data);
    return data;
  } catch (error) {
    console.error("[AgendaWidget] Failed to load agenda:", error);
    const cached = await readCache();
    return {
      status: "error",
      items: cached?.items ?? [],
      habits: cached?.habits ?? [],
      message: error instanceof Error ? error.message : String(error),
      fetchedAt: cached?.fetchedAt ?? 0,
    };
  }
}

/** The server's done keywords, or just "DONE" if it can't tell us. */
async function getDoneStates(
  api: ReturnType<typeof createApiClient>,
): Promise<string[]> {
  try {
    const states = await api.getTodoStates();
    return states?.done?.length ? states.done : [FALLBACK_DONE_STATE];
  } catch {
    return [FALLBACK_DONE_STATE];
  }
}

/**
 * The state a widget tap moves an item into: the user's configured default,
 * otherwise the server's done keywords (preferring "DONE"). Mirrors
 * useEffectiveDoneState so completing from the widget and from the app agree.
 */
async function resolveDoneState(
  api: ReturnType<typeof createApiClient>,
): Promise<string> {
  const configured = await getDefaultDoneState();
  if (configured) return configured;

  const done = await getDoneStates(api);
  return done.includes(FALLBACK_DONE_STATE) ? FALLBACK_DONE_STATE : done[0];
}

/** Minimal Todo carrying only what /complete needs to locate the entry. */
function refToTodo(ref: AgendaWidgetItemRef): Todo {
  const pos = ref.pos ? Number.parseInt(ref.pos, 10) : NaN;
  return {
    id: ref.id ?? null,
    file: ref.file ?? null,
    pos: Number.isNaN(pos) ? null : pos,
    title: ref.title ?? "",
    todo: "",
    tags: null,
    level: 0,
    scheduled: null,
    deadline: null,
    priority: null,
    olpath: null,
    notifyBefore: null,
    category: null,
    effectiveCategory: null,
  };
}

export interface CompleteAgendaWidgetItemResult {
  ok: boolean;
  /** Short line for the widget header, e.g. "Done" or "Couldn't complete". */
  message: string;
}

/**
 * Complete an item tapped on the widget. Notification cleanup is left to the
 * app: expo-notifications isn't available in the headless widget task, and the
 * server resync on next app launch reconciles repeating items anyway.
 */
export async function completeAgendaWidgetItem(
  ref: AgendaWidgetItemRef,
): Promise<CompleteAgendaWidgetItemResult> {
  if (!ref.id && (!ref.file || !ref.pos)) {
    return { ok: false, message: "Can't complete this item" };
  }

  const { apiUrl, username, password } = await getWidgetCredentials();
  if (!apiUrl || !username || !password) {
    return { ok: false, message: "Log in to complete items" };
  }

  try {
    const api = createApiClient(apiUrl, username, password);
    const [doneState, useClientCompletionTime] = await Promise.all([
      resolveDoneState(api),
      getUseClientCompletionTime(),
    ]);
    const result = await api.setTodoState(
      refToTodo(ref),
      doneState,
      useClientCompletionTime ? formatLocalDateTime(new Date()) : undefined,
    );

    if (result.status === "completed") {
      if (ref.key) await removeCachedAgendaItem(ref.key);
      return { ok: true, message: "Done" };
    }
    return { ok: false, message: result.message || "Couldn't complete" };
  } catch (error) {
    console.error("[AgendaWidget] Failed to complete item:", error);
    return { ok: false, message: "Couldn't complete — check connection" };
  }
}
