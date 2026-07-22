import { createPersistedNumberConfig } from "./persistedConfigValue";

const HORIZON_DAYS_KEY = "mova_notification_horizon_days_v1";

export const MIN_NOTIFICATION_HORIZON_DAYS = 1;
export const DEFAULT_NOTIFICATION_HORIZON_DAYS = 7;
export const MAX_NOTIFICATION_HORIZON_DAYS = 90;

const horizonDays = createPersistedNumberConfig({
  storageKey: HORIZON_DAYS_KEY,
  defaultValue: DEFAULT_NOTIFICATION_HORIZON_DAYS,
  min: MIN_NOTIFICATION_HORIZON_DAYS,
  max: MAX_NOTIFICATION_HORIZON_DAYS,
});

export const subscribeNotificationHorizonDays = horizonDays.subscribe;
export const getNotificationHorizonDays = horizonDays.get;
export const setNotificationHorizonDays = horizonDays.set;

export async function getNotificationHorizonMinutes(): Promise<number> {
  const days = await getNotificationHorizonDays();
  return days * 24 * 60;
}
