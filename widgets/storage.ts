import { NativeModules, Platform } from "react-native";

// Native SharedStorage module for cross-process data sharing
const { SharedStorage } = NativeModules;

export interface PendingTodo {
  text: string;
  timestamp: number;
  retryCount: number;
}

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
    console.log("[Widget] saveCredentialsToWidget: Not Android or no SharedStorage, skipping");
    return;
  }

  try {
    console.log("[Widget] saveCredentialsToWidget: Saving to SharedPreferences...", {
      apiUrl: apiUrl.substring(0, 20) + "...",
      username,
    });
    await SharedStorage.setItem(STORAGE_KEYS.API_URL, apiUrl);
    await SharedStorage.setItem(STORAGE_KEYS.USERNAME, username);
    await SharedStorage.setItem(STORAGE_KEYS.PASSWORD, password);
    console.log("[Widget] saveCredentialsToWidget: Credentials saved to SharedPreferences");
  } catch (error) {
    console.error("[Widget] Failed to save credentials to SharedPreferences:", error);
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
}

/**
 * Get credentials from native SharedPreferences
 * Used by widget background task
 */
export async function getWidgetCredentials(): Promise<WidgetCredentials> {
  if (Platform.OS !== "android" || !SharedStorage) {
    console.log("[Widget] getWidgetCredentials: Not Android or no SharedStorage");
    return { apiUrl: null, username: null, password: null };
  }

  try {
    console.log("[Widget] getWidgetCredentials: Reading from SharedPreferences...");
    const apiUrl = await SharedStorage.getItem(STORAGE_KEYS.API_URL);
    const username = await SharedStorage.getItem(STORAGE_KEYS.USERNAME);
    const password = await SharedStorage.getItem(STORAGE_KEYS.PASSWORD);
    console.log("[Widget] getWidgetCredentials result:", {
      hasApiUrl: !!apiUrl,
      hasUsername: !!username,
      hasPassword: !!password,
      apiUrl: apiUrl ? apiUrl.substring(0, 20) + "..." : null,
    });
    return { apiUrl, username, password };
  } catch (error) {
    console.error("[Widget] Failed to get widget credentials:", error);
    return { apiUrl: null, username: null, password: null };
  }
}

/**
 * Get pending todos that failed to sync
 */
export async function getPendingTodos(): Promise<PendingTodo[]> {
  if (Platform.OS !== "android" || !SharedStorage) return [];

  try {
    const json = await SharedStorage.getItem(STORAGE_KEYS.PENDING_TODOS);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error("[Widget] Failed to get pending todos:", error);
    return [];
  }
}

/**
 * Save pending todos
 */
export async function savePendingTodos(todos: PendingTodo[]): Promise<void> {
  if (Platform.OS !== "android" || !SharedStorage) return;

  try {
    await SharedStorage.setItem(
      STORAGE_KEYS.PENDING_TODOS,
      JSON.stringify(todos),
    );
  } catch (error) {
    console.error("[Widget] Failed to save pending todos:", error);
  }
}

/**
 * Add a todo to the pending queue
 */
export async function queuePendingTodo(text: string): Promise<void> {
  const todos = await getPendingTodos();
  todos.push({
    text,
    timestamp: Date.now(),
    retryCount: 0,
  });
  await savePendingTodos(todos);
}

/**
 * Remove a todo from the pending queue
 */
export async function removePendingTodo(timestamp: number): Promise<void> {
  const todos = await getPendingTodos();
  const filtered = todos.filter((t) => t.timestamp !== timestamp);
  await savePendingTodos(filtered);
}

/**
 * Increment retry count for a pending todo
 */
export async function incrementRetryCount(timestamp: number): Promise<void> {
  const todos = await getPendingTodos();
  const todo = todos.find((t) => t.timestamp === timestamp);
  if (todo) {
    todo.retryCount++;
    await savePendingTodos(todos);
  }
}
