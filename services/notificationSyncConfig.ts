import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_INTERVAL_MINUTES_KEY = "mova_notification_sync_interval_minutes_v1";

// iOS background fetch effectively bottoms out around 10-15 minutes and is not guaranteed.
// Keep a conservative minimum to avoid giving users a misleading setting.
export const MIN_SYNC_INTERVAL_MINUTES = 15;
export const DEFAULT_SYNC_INTERVAL_MINUTES = 15;

type Listener = (minutes: number) => void;
const listeners = new Set<Listener>();

function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_SYNC_INTERVAL_MINUTES;
  const rounded = Math.round(minutes);
  return Math.max(MIN_SYNC_INTERVAL_MINUTES, rounded);
}

export function subscribeNotificationSyncInterval(
  listener: Listener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(minutes: number) {
  for (const listener of listeners) {
    try {
      listener(minutes);
    } catch {
      // Ignore misbehaving listeners.
    }
  }
}

export async function getNotificationSyncIntervalMinutes(): Promise<number> {
  const raw = await AsyncStorage.getItem(SYNC_INTERVAL_MINUTES_KEY);
  if (!raw) return DEFAULT_SYNC_INTERVAL_MINUTES;
  const parsed = parseInt(raw, 10);
  return clampMinutes(parsed);
}

export async function setNotificationSyncIntervalMinutes(
  minutes: number,
): Promise<number> {
  const effective = clampMinutes(minutes);
  await AsyncStorage.setItem(SYNC_INTERVAL_MINUTES_KEY, String(effective));
  notify(effective);
  return effective;
}
