import { createPersistedNumberConfig } from "./persistedConfigValue";

const SYNC_INTERVAL_MINUTES_KEY = "mova_notification_sync_interval_minutes_v1";

// iOS background fetch effectively bottoms out around 10-15 minutes and is not guaranteed.
// Keep a conservative minimum to avoid giving users a misleading setting.
export const MIN_SYNC_INTERVAL_MINUTES = 15;
export const DEFAULT_SYNC_INTERVAL_MINUTES = 15;

const syncIntervalMinutes = createPersistedNumberConfig({
  storageKey: SYNC_INTERVAL_MINUTES_KEY,
  defaultValue: DEFAULT_SYNC_INTERVAL_MINUTES,
  min: MIN_SYNC_INTERVAL_MINUTES,
});

export const subscribeNotificationSyncInterval = syncIntervalMinutes.subscribe;
export const getNotificationSyncIntervalMinutes = syncIntervalMinutes.get;
export const setNotificationSyncIntervalMinutes = syncIntervalMinutes.set;
