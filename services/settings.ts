import AsyncStorage from "@react-native-async-storage/async-storage";

const QUICK_SCHEDULE_INCLUDE_TIME_KEY = "quick_schedule_include_time";
const SHOW_HABITS_IN_AGENDA_KEY = "show_habits_in_agenda";
const DEFAULT_DONE_STATE_KEY = "default_done_state";
const USE_CLIENT_COMPLETION_TIME_KEY = "use_client_completion_time";
const EXTEND_TODAY_UNTIL_HOUR_KEY = "mova_extend_today_until_hour";
const SERVER_EXTEND_TODAY_UNTIL_HOUR_KEY =
  "mova_server_extend_today_until_hour";
const GROUP_BY_CATEGORY_KEY = "mova_group_by_category";
const MULTIDAY_RANGE_LENGTH_KEY = "mova_multiday_range_length";
const MULTIDAY_PAST_DAYS_KEY = "mova_multiday_past_days";
const ALLOW_HEADLESS_INTENT_WRITES_KEY = "mova_allow_headless_intent_writes";

export async function getQuickScheduleIncludeTime(): Promise<boolean> {
  const value = await AsyncStorage.getItem(QUICK_SCHEDULE_INCLUDE_TIME_KEY);
  return value === "true";
}

export async function setQuickScheduleIncludeTime(
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(
    QUICK_SCHEDULE_INCLUDE_TIME_KEY,
    enabled ? "true" : "false",
  );
}

export async function getShowHabitsInAgenda(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SHOW_HABITS_IN_AGENDA_KEY);
  // Default to false (hide habits by default)
  return value === "true";
}

export async function setShowHabitsInAgenda(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(
    SHOW_HABITS_IN_AGENDA_KEY,
    enabled ? "true" : "false",
  );
}

export async function getDefaultDoneState(): Promise<string | null> {
  return AsyncStorage.getItem(DEFAULT_DONE_STATE_KEY);
}

export async function setDefaultDoneState(state: string | null): Promise<void> {
  if (state) {
    await AsyncStorage.setItem(DEFAULT_DONE_STATE_KEY, state);
  } else {
    await AsyncStorage.removeItem(DEFAULT_DONE_STATE_KEY);
  }
}

export async function getUseClientCompletionTime(): Promise<boolean> {
  const value = await AsyncStorage.getItem(USE_CLIENT_COMPLETION_TIME_KEY);
  // Default to true (enabled by default)
  return value !== "false";
}

export async function setUseClientCompletionTime(
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(
    USE_CLIENT_COMPLETION_TIME_KEY,
    enabled ? "true" : "false",
  );
}

export async function getAllowHeadlessIntentWrites(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ALLOW_HEADLESS_INTENT_WRITES_KEY);
  return value === "true";
}

export async function setAllowHeadlessIntentWrites(
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(
    ALLOW_HEADLESS_INTENT_WRITES_KEY,
    enabled ? "true" : "false",
  );
}

function parseHour(value: string | null): number | null {
  if (value === null) return null;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 23) return null;
  return parsed;
}

/**
 * The server's `org-extend-today-until`, mirrored from /metadata so code
 * running outside React (widget, background tasks) can read it. Null when the
 * server has not reported one — org-agenda-api only sends it from 4.6.0 on.
 */
export async function getServerExtendTodayUntilHour(): Promise<number | null> {
  return parseHour(
    await AsyncStorage.getItem(SERVER_EXTEND_TODAY_UNTIL_HOUR_KEY),
  );
}

const serverExtendTodayListeners = new Set<(hour: number | null) => void>();

export function subscribeToServerExtendTodayUntilHour(
  listener: (hour: number | null) => void,
): () => void {
  serverExtendTodayListeners.add(listener);
  return () => {
    serverExtendTodayListeners.delete(listener);
  };
}

export async function cacheServerExtendTodayUntilHour(
  hour: number | null,
): Promise<void> {
  if (hour === null) {
    await AsyncStorage.removeItem(SERVER_EXTEND_TODAY_UNTIL_HOUR_KEY);
  } else {
    await AsyncStorage.setItem(SERVER_EXTEND_TODAY_UNTIL_HOUR_KEY, `${hour}`);
  }
  serverExtendTodayListeners.forEach((listener) => listener(hour));
}

/**
 * Device-local fallback, used only while the server reports nothing. The org
 * config is the source of truth whenever it is available.
 */
export async function getExtendTodayUntilHour(): Promise<number> {
  return (
    parseHour(await AsyncStorage.getItem(EXTEND_TODAY_UNTIL_HOUR_KEY)) ?? 0
  );
}

export async function setExtendTodayUntilHour(hour: number): Promise<void> {
  await AsyncStorage.setItem(EXTEND_TODAY_UNTIL_HOUR_KEY, hour.toString());
}

/** Hour before which completions still count as the previous day. */
export async function getEffectiveExtendTodayUntilHour(): Promise<number> {
  const [server, local] = await Promise.all([
    getServerExtendTodayUntilHour(),
    getExtendTodayUntilHour(),
  ]);
  return server ?? local;
}

export async function getGroupByCategory(): Promise<boolean> {
  const value = await AsyncStorage.getItem(GROUP_BY_CATEGORY_KEY);
  return value === "true";
}

export async function setGroupByCategory(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(GROUP_BY_CATEGORY_KEY, enabled ? "true" : "false");
}

export async function getMultiDayRangeLength(): Promise<number> {
  const value = await AsyncStorage.getItem(MULTIDAY_RANGE_LENGTH_KEY);
  return value ? parseInt(value, 10) : 7; // Default: 7 days
}

export async function setMultiDayRangeLength(days: number): Promise<void> {
  await AsyncStorage.setItem(MULTIDAY_RANGE_LENGTH_KEY, days.toString());
}

export async function getMultiDayPastDays(): Promise<number> {
  const value = await AsyncStorage.getItem(MULTIDAY_PAST_DAYS_KEY);
  return value ? parseInt(value, 10) : 1; // Default: 1 day of past
}

export async function setMultiDayPastDays(days: number): Promise<void> {
  await AsyncStorage.setItem(MULTIDAY_PAST_DAYS_KEY, days.toString());
}
