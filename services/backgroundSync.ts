import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { scheduleNotificationsForTodos, getNotificationsEnabled } from './notifications';

const BACKGROUND_SYNC_TASK = 'MOVA_BACKGROUND_SYNC';

// Storage keys for credentials (shared with AuthContext)
const API_URL_KEY = 'api_url';
const USERNAME_KEY = 'username';
const PASSWORD_KEY = 'password';

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

// Define the background task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const enabled = await getNotificationsEnabled();
    if (!enabled) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const { apiUrl, username, password } = await getStoredCredentials();
    if (!apiUrl || !username || !password) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    api.configure(apiUrl, username, password);
    const response = await api.getAllTodos();

    const count = await scheduleNotificationsForTodos(response.todos, response.defaults);
    console.log(`Background sync: scheduled ${count} notifications`);

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error('Background sync failed:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (minimum on iOS)
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Background sync registered');
  } catch (err) {
    console.error('Failed to register background sync:', err);
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    console.log('Background sync unregistered');
  } catch (err) {
    console.error('Failed to unregister background sync:', err);
  }
}

export async function isBackgroundSyncRegistered(): Promise<boolean> {
  return await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
}

export async function getBackgroundSyncStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
  return await BackgroundFetch.getStatusAsync();
}
