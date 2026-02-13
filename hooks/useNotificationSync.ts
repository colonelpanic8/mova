import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { registerBackgroundSync } from "@/services/backgroundSync";
import {
  getLastSyncTime,
  getNotificationsEnabled,
  getScheduledNotificationCount,
  isNotificationActive,
  scheduleNotificationsFromServer,
  updateActiveNotificationIds,
} from "@/services/notifications";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

export interface UseNotificationSyncOptions {
  autoSync?: boolean;
  syncOnForeground?: boolean;
  prefireVerification?: boolean;
  registerBackgroundSync?: boolean;
}

export function useNotificationSync(options: UseNotificationSyncOptions = {}) {
  const {
    autoSync = true,
    syncOnForeground = true,
    prefireVerification = true,
    registerBackgroundSync: shouldRegisterBackgroundSync = true,
  } = options;
  const { isAuthenticated } = useAuth();
  const api = useApi();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncNotifications = useCallback(async () => {
    if (!isAuthenticated || !api) return;

    const enabled = await getNotificationsEnabled();
    if (!enabled) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await api.getNotifications();
      const count = await scheduleNotificationsFromServer(response);

      setScheduledCount(count);
      setLastSync(new Date());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Notification sync failed";
      console.error("Notification sync failed:", err);
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, api]);

  // Pre-fire verification (foreground best-effort): suppress/dismiss notifications
  // that are no longer part of the most recently synced active ID set.
  useEffect(() => {
    if (!prefireVerification) return;
    if (Platform.OS === "web") return;

    const subscription = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const identifier = notification.request.identifier;
        if (!isNotificationActive(identifier)) {
          try {
            await Notifications.dismissNotificationAsync(identifier);
            console.log(`[Notifications] Dismissed stale notification: ${identifier}`);
          } catch {
            // Ignore; failing to dismiss should not break notifications.
          }
        }
      },
    );

    return () => subscription.remove();
  }, [prefireVerification]);

  // Sync on mount and when app comes to foreground
  useEffect(() => {
    if (autoSync) {
      syncNotifications();
    }

    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (syncOnForeground && state === "active") {
          syncNotifications();
        }
      },
    );

    return () => subscription.remove();
  }, [syncNotifications, autoSync, syncOnForeground]);

  // Register background sync on mount
  useEffect(() => {
    if (shouldRegisterBackgroundSync) {
      registerBackgroundSync();
    }
  }, [shouldRegisterBackgroundSync]);

  // Update stats on mount
  useEffect(() => {
    getLastSyncTime().then(setLastSync);
    getScheduledNotificationCount().then(setScheduledCount);
  }, []);

  return {
    lastSync,
    scheduledCount,
    isSyncing,
    syncError,
    syncNotifications,
  };
}
