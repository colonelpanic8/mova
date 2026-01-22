import AsyncStorage from "@react-native-async-storage/async-storage";

const QUICK_SCHEDULE_INCLUDE_TIME_KEY = "quick_schedule_include_time";
const SHOW_HABITS_IN_AGENDA_KEY = "show_habits_in_agenda";
const DEFAULT_DONE_STATE_KEY = "default_done_state";

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
