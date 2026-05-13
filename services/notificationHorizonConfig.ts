import AsyncStorage from "@react-native-async-storage/async-storage";

const HORIZON_DAYS_KEY = "mova_notification_horizon_days_v1";

export const MIN_NOTIFICATION_HORIZON_DAYS = 1;
export const DEFAULT_NOTIFICATION_HORIZON_DAYS = 7;
export const MAX_NOTIFICATION_HORIZON_DAYS = 90;

type Listener = (days: number) => void;
const listeners = new Set<Listener>();

function clampDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_NOTIFICATION_HORIZON_DAYS;
  const rounded = Math.round(days);
  return Math.min(
    MAX_NOTIFICATION_HORIZON_DAYS,
    Math.max(MIN_NOTIFICATION_HORIZON_DAYS, rounded),
  );
}

export function subscribeNotificationHorizonDays(
  listener: Listener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(days: number) {
  for (const listener of listeners) {
    try {
      listener(days);
    } catch {
      // Ignore.
    }
  }
}

export async function getNotificationHorizonDays(): Promise<number> {
  const raw = await AsyncStorage.getItem(HORIZON_DAYS_KEY);
  if (!raw) return DEFAULT_NOTIFICATION_HORIZON_DAYS;
  const parsed = parseInt(raw, 10);
  return clampDays(parsed);
}

export async function setNotificationHorizonDays(
  days: number,
): Promise<number> {
  const effective = clampDays(days);
  await AsyncStorage.setItem(HORIZON_DAYS_KEY, String(effective));
  notify(effective);
  return effective;
}

export async function getNotificationHorizonMinutes(): Promise<number> {
  const days = await getNotificationHorizonDays();
  return days * 24 * 60;
}
