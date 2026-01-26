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

export function useNotificationSync() {
  const { isAuthenticated } = useAuth();
  const api = useApi();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const verificationInProgress = useRef(false);

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

  // Pre-fire verification: check notification still exists before showing
  useEffect(() => {
    if (Platform.OS === "web" || !api) return;

    const subscription = Notifications.addNotificationReceivedListener(
      async (notification) => {
        // Avoid concurrent verification calls
        if (verificationInProgress.current) return;
        verificationInProgress.current = true;

        try {
          // Quick fetch to verify notification still exists
          const response = await api.getNotifications();
          updateActiveNotificationIds(response.notifications);

          const identifier = notification.request.identifier;
          if (!isNotificationActive(identifier)) {
            // Notification no longer valid, dismiss it
            await Notifications.dismissNotificationAsync(
              notification.request.identifier,
            );
            console.log(`Dismissed stale notification: ${identifier}`);
          }
        } catch (err) {
          // On fetch failure, allow notification to show (fail-open)
          console.log("Verification fetch failed, allowing notification:", err);
        } finally {
          verificationInProgress.current = false;
        }
      },
    );

    return () => subscription.remove();
  }, [api]);

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
    syncError,
    syncNotifications,
  };
}
