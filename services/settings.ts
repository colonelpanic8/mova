import AsyncStorage from "@react-native-async-storage/async-storage";

const QUICK_SCHEDULE_INCLUDE_TIME_KEY = "quick_schedule_include_time";

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
