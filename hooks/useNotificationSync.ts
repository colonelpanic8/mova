import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { registerBackgroundSync } from "@/services/backgroundSync";
import { getNotificationHorizonMinutes } from "@/services/notificationHorizonConfig";
import {
  getNotificationSyncIntervalMinutes,
  subscribeNotificationSyncInterval,
} from "@/services/notificationSyncConfig";
import {
  getLastSyncTime,
  getNotificationsEnabled,
  getScheduledNotificationCount,
  isNotificationActive,
  scheduleNotificationsFromServer,
} from "@/services/notifications";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

export interface UseNotificationSyncOptions {
  autoSync?: boolean;
  syncOnForeground?: boolean;
  foregroundSyncIntervalMs?: number | null;
  prefireVerification?: boolean;
  registerBackgroundSync?: boolean;
}

const DEFAULT_FOREGROUND_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function useNotificationSync(options: UseNotificationSyncOptions = {}) {
  const {
    autoSync = true,
    syncOnForeground = true,
    foregroundSyncIntervalMs,
    prefireVerification = true,
    registerBackgroundSync: shouldRegisterBackgroundSync = true,
  } = options;
  const { isAuthenticated } = useAuth();
  const api = useApi();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncInFlightRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const [resolvedForegroundIntervalMs, setResolvedForegroundIntervalMs] =
    useState<number | null>(() => {
      if (foregroundSyncIntervalMs !== undefined)
        return foregroundSyncIntervalMs;
      if (!autoSync) return null;
      return DEFAULT_FOREGROUND_SYNC_INTERVAL_MS;
    });

  // If foreground interval isn't explicitly set, follow the persisted sync interval setting.
  useEffect(() => {
    if (foregroundSyncIntervalMs !== undefined) {
      setResolvedForegroundIntervalMs(foregroundSyncIntervalMs);
      return;
    }
    if (!autoSync) {
      setResolvedForegroundIntervalMs(null);
      return;
    }

    let cancelled = false;
    getNotificationSyncIntervalMinutes()
      .then((minutes) => {
        if (cancelled) return;
        setResolvedForegroundIntervalMs(minutes * 60 * 1000);
      })
      .catch(() => {
        // Keep default.
      });

    const unsubscribe = subscribeNotificationSyncInterval((minutes) => {
      setResolvedForegroundIntervalMs(minutes * 60 * 1000);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [foregroundSyncIntervalMs, autoSync]);

  const syncNotifications = useCallback(async () => {
    if (!isAuthenticated || !api) return;

    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    try {
      const enabled = await getNotificationsEnabled();
      if (!enabled) return;

      setIsSyncing(true);
      setSyncError(null);

      const withinMinutes = await getNotificationHorizonMinutes();
      const response = await api.getNotifications({ withinMinutes });
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
      syncInFlightRef.current = false;
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
            console.log(
              `[Notifications] Dismissed stale notification: ${identifier}`,
            );
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
        appStateRef.current = state;
        if (syncOnForeground && state === "active") {
          syncNotifications();
        }
      },
    );

    return () => subscription.remove();
  }, [syncNotifications, autoSync, syncOnForeground]);

  // Periodic sync while app stays active (foreground best-effort).
  useEffect(() => {
    if (!autoSync) return;
    if (!resolvedForegroundIntervalMs) return;

    const intervalId = setInterval(() => {
      if (appStateRef.current !== "active") return;
      void syncNotifications();
    }, resolvedForegroundIntervalMs);

    return () => clearInterval(intervalId);
  }, [autoSync, resolvedForegroundIntervalMs, syncNotifications]);

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
