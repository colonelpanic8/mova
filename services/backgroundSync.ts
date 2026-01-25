import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";

const BACKGROUND_SYNC_TASK = "MOVA_BACKGROUND_SYNC";

// Check if we're in a headless context (widget, background task, etc.)
// In headless context, AppState.currentState is null/undefined
const isHeadlessContext = () => {
  return AppState.currentState === null || AppState.currentState === undefined;
};

// Storage keys for credentials (shared with AuthContext)
const API_URL_KEY = "api_url";
const USERNAME_KEY = "username";
const PASSWORD_KEY = "password";

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

// Lazy-load expo modules to avoid issues in headless widget context
let BackgroundFetch: typeof import("expo-background-fetch") | null = null;
let TaskManager: typeof import("expo-task-manager") | null = null;

async function loadExpoModules() {
  if (!BackgroundFetch) {
    BackgroundFetch = await import("expo-background-fetch");
  }
  if (!TaskManager) {
    TaskManager = await import("expo-task-manager");
  }
  return { BackgroundFetch, TaskManager };
}

// Define the background task (native only)
// Uses setTimeout to defer loading expo modules until after initial render
// Skip in headless context (widget) to avoid expo module errors
if (Platform.OS !== "web") {
  setTimeout(async () => {
    // Don't load expo modules in headless context (widget, background tasks)
    if (isHeadlessContext()) {
      console.log("[BackgroundSync] Skipping in headless context");
      return;
    }

    try {
      const { TaskManager: TM, BackgroundFetch: BF } = await loadExpoModules();
      const { createApiClient } = await import("./api");
      const { getNotificationsEnabled, scheduleNotificationsForTodos } =
        await import("./notifications");

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
          const response = await api.getAllTodos();

          const count = await scheduleNotificationsForTodos(
            response.todos,
            response.defaults,
          );
          console.log(`Background sync: scheduled ${count} notifications`);

          return BF.BackgroundFetchResult.NewData;
        } catch (err) {
          console.error("Background sync failed:", err);
          return BF.BackgroundFetchResult.Failed;
        }
      });
    } catch (e) {
      // This is expected to fail in headless widget context
      console.log(
        "[BackgroundSync] Skipping task definition in headless context:",
        e,
      );
    }
  }, 0);
}

export async function registerBackgroundSync(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { BackgroundFetch: BF } = await loadExpoModules();
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
    const { BackgroundFetch: BF } = await loadExpoModules();
    await BF.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    console.log("Background sync unregistered");
  } catch (err) {
    console.error("Failed to unregister background sync:", err);
  }
}

export async function isBackgroundSyncRegistered(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { TaskManager: TM } = await loadExpoModules();
  return await TM.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
}

export async function getBackgroundSyncStatus(): Promise<
  import("expo-background-fetch").BackgroundFetchStatus | null
> {
  if (Platform.OS === "web") return null;
  const { BackgroundFetch: BF } = await loadExpoModules();
  return await BF.getStatusAsync();
}
