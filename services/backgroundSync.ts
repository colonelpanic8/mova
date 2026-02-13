import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BACKGROUND_SYNC_TASK = "MOVA_BACKGROUND_SYNC";

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
    BackgroundFetch = require("expo-background-fetch") as typeof import("expo-background-fetch");
  }
  if (!TaskManager) {
    TaskManager = require("expo-task-manager") as typeof import("expo-task-manager");
  }
  // require() guarantees these are set, but TS can't see that.
  return { BackgroundFetch: BackgroundFetch!, TaskManager: TaskManager! };
}

if (Platform.OS !== "web") {
  try {
    const { BackgroundFetch: BF, TaskManager: TM } = getExpoModules();
    const { createApiClient } = require("./api");
    const { getNotificationsEnabled, scheduleNotificationsFromServer } =
      require("./notifications");

    TM.defineTask(BACKGROUND_SYNC_TASK, async () => {
      try {
        const enabled = await getNotificationsEnabled();
        if (!enabled) {
          return BF.BackgroundFetchResult.NoData;
        }

        const { apiUrl, username, password } = await getStoredCredentials();
        if (!apiUrl || !username || !password) {
          return BF.BackgroundFetchResult.NoData;
        }

        const api = createApiClient(apiUrl, username, password);
        const response = await api.getNotifications();

        const count = await scheduleNotificationsFromServer(response);
        console.log(`Background sync: scheduled ${count} notifications`);

        return BF.BackgroundFetchResult.NewData;
      } catch (err) {
        console.error("Background sync failed:", err);
        return BF.BackgroundFetchResult.Failed;
      }
    });
  } catch (e) {
    console.log("[BackgroundSync] Unable to define background task:", e);
  }
}

export async function registerBackgroundSync(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { BackgroundFetch: BF } = getExpoModules();
    await BF.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (minimum on iOS)
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log("Background sync registered");
  } catch (err) {
    console.error("Failed to register background sync:", err);
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { BackgroundFetch: BF } = getExpoModules();
    await BF.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    console.log("Background sync unregistered");
  } catch (err) {
    console.error("Failed to unregister background sync:", err);
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
