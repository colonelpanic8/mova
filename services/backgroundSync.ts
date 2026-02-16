import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getNotificationHorizonMinutes } from "./notificationHorizonConfig";
import { getNotificationSyncIntervalMinutes } from "./notificationSyncConfig";

const BACKGROUND_SYNC_TASK = "MOVA_BACKGROUND_SYNC";
const BACKGROUND_SYNC_ATTEMPTS_KEY = "mova_background_sync_attempts_v1";
const MAX_BACKGROUND_SYNC_ATTEMPTS = 100;

// Storage keys for credentials (must match AuthContext STORAGE_KEYS)
const API_URL_KEY = "mova_api_url";
const USERNAME_KEY = "mova_username";
const PASSWORD_KEY = "mova_password";

async function getStoredCredentials(): Promise<{
  apiUrl: string | null;
  username: string | null;
  password: string | null;
}> {
  const [apiUrl, username, password] = await Promise.all([
    AsyncStorage.getItem(API_URL_KEY),
    AsyncStorage.getItem(USERNAME_KEY),
    AsyncStorage.getItem(PASSWORD_KEY),
  ]);
  return { apiUrl, username, password };
}

export interface BackgroundSyncAttempt {
  timestamp: string;
  source: "task" | "register" | "unregister" | "define";
  result: "success" | "no_data" | "failed" | "skipped";
  reason?: string;
  details?: string;
}

async function appendBackgroundSyncAttempt(
  attempt: BackgroundSyncAttempt,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(BACKGROUND_SYNC_ATTEMPTS_KEY);
    const existing = raw ? (JSON.parse(raw) as BackgroundSyncAttempt[]) : [];
    const next = [attempt, ...existing].slice(0, MAX_BACKGROUND_SYNC_ATTEMPTS);
    await AsyncStorage.setItem(
      BACKGROUND_SYNC_ATTEMPTS_KEY,
      JSON.stringify(next),
    );
  } catch {
    // Ignore logging failures.
  }
}

export async function getBackgroundSyncAttempts(
  limit: number = 30,
): Promise<BackgroundSyncAttempt[]> {
  try {
    const raw = await AsyncStorage.getItem(BACKGROUND_SYNC_ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const safe = parsed.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<BackgroundSyncAttempt>;
      return (
        typeof candidate.timestamp === "string" &&
        typeof candidate.source === "string" &&
        typeof candidate.result === "string"
      );
    }) as BackgroundSyncAttempt[];
    return safe.slice(0, Math.max(0, limit));
  } catch {
    return [];
  }
}

export async function clearBackgroundSyncAttempts(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BACKGROUND_SYNC_ATTEMPTS_KEY);
  } catch {
    // Ignore.
  }
}

// In Expo, TaskManager tasks should be defined at module scope so they exist
// in headless/background execution contexts as well.
//
// We avoid static imports because some headless/widget contexts can throw when
// loading certain Expo native modules; require() + try/catch keeps the app alive.
let BackgroundFetch: typeof import("expo-background-fetch") | null = null;
let TaskManager: typeof import("expo-task-manager") | null = null;

function getExpoModules(): {
  BackgroundFetch: typeof import("expo-background-fetch");
  TaskManager: typeof import("expo-task-manager");
} {
  if (!BackgroundFetch) {
    BackgroundFetch =
      require("expo-background-fetch") as typeof import("expo-background-fetch");
  }
  if (!TaskManager) {
    TaskManager =
      require("expo-task-manager") as typeof import("expo-task-manager");
  }
  // require() guarantees these are set, but TS can't see that.
  return { BackgroundFetch: BackgroundFetch!, TaskManager: TaskManager! };
}

if (Platform.OS !== "web") {
  try {
    const { BackgroundFetch: BF, TaskManager: TM } = getExpoModules();
    const { createApiClient } = require("./api");
    const {
      getNotificationsEnabled,
      scheduleNotificationsFromServer,
    } = require("./notifications");

    TM.defineTask(BACKGROUND_SYNC_TASK, async () => {
      try {
        const enabled = await getNotificationsEnabled();
        if (!enabled) {
          await appendBackgroundSyncAttempt({
            timestamp: new Date().toISOString(),
            source: "task",
            result: "no_data",
            reason: "notifications_disabled",
          });
          return BF.BackgroundFetchResult.NoData;
        }

        const { apiUrl, username, password } = await getStoredCredentials();
        if (!apiUrl || !username || !password) {
          await appendBackgroundSyncAttempt({
            timestamp: new Date().toISOString(),
            source: "task",
            result: "no_data",
            reason: "missing_credentials",
          });
          return BF.BackgroundFetchResult.NoData;
        }

        const api = createApiClient(apiUrl, username, password);
        const withinMinutes = await getNotificationHorizonMinutes();
        const response = await api.getNotifications({ withinMinutes });

        const count = await scheduleNotificationsFromServer(response);
        console.log(`Background sync: scheduled ${count} notifications`);
        await appendBackgroundSyncAttempt({
          timestamp: new Date().toISOString(),
          source: "task",
          result: "success",
          details: `scheduled=${count};within_minutes=${withinMinutes}`,
        });

        return BF.BackgroundFetchResult.NewData;
      } catch (err) {
        console.error("Background sync failed:", err);
        await appendBackgroundSyncAttempt({
          timestamp: new Date().toISOString(),
          source: "task",
          result: "failed",
          reason: err instanceof Error ? err.message : String(err),
        });
        return BF.BackgroundFetchResult.Failed;
      }
    });
  } catch (e) {
    console.log("[BackgroundSync] Unable to define background task:", e);
    void appendBackgroundSyncAttempt({
      timestamp: new Date().toISOString(),
      source: "define",
      result: "failed",
      reason: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function registerBackgroundSync(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { BackgroundFetch: BF } = getExpoModules();
    const intervalMinutes = await getNotificationSyncIntervalMinutes();
    const intervalSeconds = intervalMinutes * 60;

    // iOS treats this as advisory-only; Android ignores it.
    try {
      await BF.setMinimumIntervalAsync(intervalSeconds);
    } catch {
      // Ignore platform/module differences.
    }
    await BF.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: intervalSeconds,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log("Background sync registered");
    await appendBackgroundSyncAttempt({
      timestamp: new Date().toISOString(),
      source: "register",
      result: "success",
      details: `interval_seconds=${intervalSeconds}`,
    });
  } catch (err) {
    console.error("Failed to register background sync:", err);
    await appendBackgroundSyncAttempt({
      timestamp: new Date().toISOString(),
      source: "register",
      result: "failed",
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { BackgroundFetch: BF } = getExpoModules();
    await BF.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    console.log("Background sync unregistered");
    await appendBackgroundSyncAttempt({
      timestamp: new Date().toISOString(),
      source: "unregister",
      result: "success",
    });
  } catch (err) {
    console.error("Failed to unregister background sync:", err);
    await appendBackgroundSyncAttempt({
      timestamp: new Date().toISOString(),
      source: "unregister",
      result: "failed",
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function isBackgroundSyncRegistered(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { TaskManager: TM } = getExpoModules();
  return await TM.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
}

export async function getBackgroundSyncStatus(): Promise<
  import("expo-background-fetch").BackgroundFetchStatus | null
> {
  if (Platform.OS === "web") return null;
  const { BackgroundFetch: BF } = getExpoModules();
  return await BF.getStatusAsync();
}
