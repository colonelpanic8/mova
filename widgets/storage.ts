import { NativeModules, Platform } from "react-native";

// Native SharedStorage module for cross-process data sharing
const { SharedStorage, WearSync } = NativeModules;

export interface WidgetCredentials {
  apiUrl: string | null;
  username: string | null;
  password: string | null;
}

// Storage keys
export const STORAGE_KEYS = {
  API_URL: "mova_api_url",
  USERNAME: "mova_username",
  PASSWORD: "mova_password",
  // Legacy key for the removed JS pending-capture queue; still cleared on
  // logout so old installs don't retain stale captures.
  PENDING_TODOS: "mova_pending_todos",
};

/**
 * Save credentials to native SharedPreferences (for widget access)
 * Call this from the main app when user logs in
 */
export async function saveCredentialsToWidget(
  apiUrl: string,
  username: string,
  password: string,
): Promise<void> {
  if (Platform.OS !== "android" || !SharedStorage) {
    console.log(
      "[Widget] saveCredentialsToWidget: Not Android or no SharedStorage, skipping",
    );
    return;
  }

  try {
    await SharedStorage.setItem(STORAGE_KEYS.API_URL, apiUrl);
    await SharedStorage.setItem(STORAGE_KEYS.USERNAME, username);
    await SharedStorage.setItem(STORAGE_KEYS.PASSWORD, password);
    console.log(
      "[Widget] saveCredentialsToWidget: Credentials saved to SharedPreferences",
    );
  } catch (error) {
    console.error(
      "[Widget] Failed to save credentials to SharedPreferences:",
      error,
    );
  }

  if (WearSync) {
    try {
      await WearSync.syncCredentials(apiUrl, username, password);
      console.log("[Wear] Credentials synced to Wear OS");
    } catch (error) {
      console.error("[Wear] Failed to sync credentials:", error);
    }
  }
}

/**
 * Clear credentials from SharedPreferences
 * Call this from the main app when user logs out
 */
export async function clearWidgetCredentials(): Promise<void> {
  if (Platform.OS !== "android" || !SharedStorage) return;

  try {
    await SharedStorage.removeItem(STORAGE_KEYS.API_URL);
    await SharedStorage.removeItem(STORAGE_KEYS.USERNAME);
    await SharedStorage.removeItem(STORAGE_KEYS.PASSWORD);
    await SharedStorage.removeItem(STORAGE_KEYS.PENDING_TODOS);
  } catch (error) {
    console.error("[Widget] Failed to clear widget credentials:", error);
  }

  if (WearSync) {
    try {
      await WearSync.clearCredentials();
      console.log("[Wear] Credentials cleared on Wear OS");
    } catch (error) {
      console.error("[Wear] Failed to clear credentials:", error);
    }
  }
}

/**
 * Get credentials from native SharedPreferences
 * Used by widget background task
 */
export async function getWidgetCredentials(): Promise<WidgetCredentials> {
  if (Platform.OS !== "android" || !SharedStorage) {
    console.log(
      "[Widget] getWidgetCredentials: Not Android or no SharedStorage",
    );
    return { apiUrl: null, username: null, password: null };
  }

  try {
    console.log(
      "[Widget] getWidgetCredentials: Reading from SharedPreferences...",
    );
    const apiUrl = await SharedStorage.getItem(STORAGE_KEYS.API_URL);
    const username = await SharedStorage.getItem(STORAGE_KEYS.USERNAME);
    const password = await SharedStorage.getItem(STORAGE_KEYS.PASSWORD);
    return { apiUrl, username, password };
  } catch (error) {
    console.error("[Widget] Failed to get widget credentials:", error);
    return { apiUrl: null, username: null, password: null };
  }
}
