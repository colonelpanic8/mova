import AsyncStorage from "@react-native-async-storage/async-storage";

const QUICK_SCHEDULE_INCLUDE_TIME_KEY = "quick_schedule_include_time";
const SHOW_HABITS_IN_AGENDA_KEY = "show_habits_in_agenda";
const DEFAULT_DONE_STATE_KEY = "default_done_state";
const USE_CLIENT_COMPLETION_TIME_KEY = "use_client_completion_time";
const GROUP_BY_CATEGORY_KEY = "mova_group_by_category";

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

export async function getGroupByCategory(): Promise<boolean> {
  const value = await AsyncStorage.getItem(GROUP_BY_CATEGORY_KEY);
  return value === "true";
}

export async function setGroupByCategory(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(
    GROUP_BY_CATEGORY_KEY,
    enabled ? "true" : "false",
  );
}
