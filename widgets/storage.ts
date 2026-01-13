import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_NAME = 'mova_widget_prefs';

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
  API_URL: 'mova_api_url',
  USERNAME: 'mova_username',
  PASSWORD: 'mova_password',
  PENDING_TODOS: 'mova_pending_todos',
};

/**
 * Save credentials to AsyncStorage (for widget access)
 * Call this from the main app when user logs in
 */
export async function saveCredentialsToWidget(
  apiUrl: string,
  username: string,
  password: string
): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await AsyncStorage.setItem(STORAGE_KEYS.API_URL, apiUrl);
    await AsyncStorage.setItem(STORAGE_KEYS.USERNAME, username);
    await AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, password);
  } catch (error) {
    console.error('Failed to save credentials to widget storage:', error);
  }
}

/**
 * Clear credentials from AsyncStorage
 * Call this from the main app when user logs out
 */
export async function clearWidgetCredentials(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.API_URL);
    await AsyncStorage.removeItem(STORAGE_KEYS.USERNAME);
    await AsyncStorage.removeItem(STORAGE_KEYS.PASSWORD);
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_TODOS);
  } catch (error) {
    console.error('Failed to clear widget credentials:', error);
  }
}

/**
 * Get credentials from AsyncStorage
 * Used by widget background task
 */
export async function getWidgetCredentials(): Promise<WidgetCredentials> {
  if (Platform.OS !== 'android') {
    return { apiUrl: null, username: null, password: null };
  }

  try {
    const apiUrl = await AsyncStorage.getItem(STORAGE_KEYS.API_URL);
    const username = await AsyncStorage.getItem(STORAGE_KEYS.USERNAME);
    const password = await AsyncStorage.getItem(STORAGE_KEYS.PASSWORD);
    return { apiUrl, username, password };
  } catch (error) {
    console.error('Failed to get widget credentials:', error);
    return { apiUrl: null, username: null, password: null };
  }
}

/**
 * Get pending todos that failed to sync
 */
export async function getPendingTodos(): Promise<PendingTodo[]> {
  if (Platform.OS !== 'android') return [];

  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_TODOS);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('Failed to get pending todos:', error);
    return [];
  }
}

/**
 * Save pending todos
 */
export async function savePendingTodos(todos: PendingTodo[]): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.PENDING_TODOS,
      JSON.stringify(todos)
    );
  } catch (error) {
    console.error('Failed to save pending todos:', error);
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
  const filtered = todos.filter(t => t.timestamp !== timestamp);
  await savePendingTodos(filtered);
}

/**
 * Increment retry count for a pending todo
 */
export async function incrementRetryCount(timestamp: number): Promise<void> {
  const todos = await getPendingTodos();
  const todo = todos.find(t => t.timestamp === timestamp);
  if (todo) {
    todo.retryCount++;
    await savePendingTodos(todos);
  }
}
