import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { registerBackgroundSync } from "@/services/backgroundSync";
import {
  getLastSyncTime,
  getNotificationsEnabled,
  getScheduledNotificationCount,
  scheduleNotificationsForTodos,
} from "@/services/notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

export function useNotificationSync() {
  const { isAuthenticated, apiUrl, username, password } = useAuth();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncNotifications = useCallback(async () => {
    if (!isAuthenticated || !apiUrl || !username || !password) return;

    const enabled = await getNotificationsEnabled();
    if (!enabled) return;

    setIsSyncing(true);
    try {
      api.configure(apiUrl, username, password);
      const response = await api.getAllTodos();
      const count = await scheduleNotificationsForTodos(
        response.todos,
        response.defaults,
      );

      setScheduledCount(count);
      setLastSync(new Date());
    } catch (err) {
      console.error("Notification sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, apiUrl, username, password]);

  // Sync on mount and when app comes to foreground
  useEffect(() => {
    syncNotifications();

    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          syncNotifications();
        }
      },
    );

    return () => subscription.remove();
  }, [syncNotifications]);

  // Register background sync on mount
  useEffect(() => {
    registerBackgroundSync();
  }, []);

  // Update stats on mount
  useEffect(() => {
    getLastSyncTime().then(setLastSync);
    getScheduledNotificationCount().then(setScheduledCount);
  }, []);

  return {
    lastSync,
    scheduledCount,
    isSyncing,
    syncNotifications,
  };
}
