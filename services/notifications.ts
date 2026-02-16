import { formatTimeFromDate, formatTimeUntil } from "@/utils/timeFormatting";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { NotificationsResponse, ServerNotification } from "./api";

const NOTIFICATIONS_ENABLED_KEY = "notifications_enabled";
const LAST_SYNC_KEY = "last_notification_sync";
const ACTIVE_NOTIFICATION_IDS_KEY = "active_notification_ids_v1";

let activeIdsLoadedFromStorage = false;
let hasKnownActiveIds = false;
async function ensureActiveIdsLoaded(): Promise<void> {
  if (activeIdsLoadedFromStorage) return;
  activeIdsLoadedFromStorage = true;

  try {
    const raw = await AsyncStorage.getItem(ACTIVE_NOTIFICATION_IDS_KEY);
    if (!raw) {
      // No prior sync info; fail-open (do not suppress foreground notifications).
      hasKnownActiveIds = false;
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      hasKnownActiveIds = false;
      return;
    }
    activeNotificationIds = new Set(
      parsed.filter((x) => typeof x === "string"),
    );
    hasKnownActiveIds = true;
  } catch {
    // Ignore storage corruption; fail-open.
    hasKnownActiveIds = false;
  }
}

// Configure how notifications are displayed when app is in foreground (native only)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // If the notification is no longer part of the most recently synced set,
      // suppress foreground display (best-effort). Background notifications
      // can't be prevented here.
      await ensureActiveIdsLoaded();
      if (!hasKnownActiveIds) {
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      }
      const identifier = notification.request.identifier;
      const isActive = isNotificationActive(identifier);
      return {
        shouldShowAlert: isActive,
        shouldPlaySound: isActive,
        shouldSetBadge: false,
        shouldShowBanner: isActive,
        shouldShowList: isActive,
      };
    },
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

// Non-interactive permission check (safe for background/auto sync).
export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

export async function getNotificationsEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
  return value === "true";
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(
    NOTIFICATIONS_ENABLED_KEY,
    enabled ? "true" : "false",
  );
  if (!enabled) {
    await cancelAllNotifications();
    hasKnownActiveIds = false;
    activeNotificationIds = new Set();
    activeIdsLoadedFromStorage = true;
    try {
      await AsyncStorage.removeItem(ACTIVE_NOTIFICATION_IDS_KEY);
    } catch {
      // Ignore.
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function getNotificationIdentifier(
  notification: ServerNotification,
  index: number,
): string {
  if (notification.id) return notification.id;
  if (notification.file && notification.pos != null) {
    return `${notification.file}:${notification.pos}`;
  }
  // Fallback to index-based ID if no other identifier available
  return `notif-${index}`;
}

function formatNotificationBody(notification: ServerNotification): string {
  const parts: string[] = [];

  // Add time info for relative notifications
  if (
    notification.type === "relative" &&
    notification.minutesBefore &&
    notification.eventTime
  ) {
    const eventDate = new Date(notification.eventTime);
    parts.push(
      `${formatTimeUntil(notification.minutesBefore)} at ${formatTimeFromDate(eventDate)}`,
    );
  }

  // Add type label
  const typeLabel =
    notification.type === "day-wide" ? "day-wide" : notification.type;
  const timestampLabel = notification.timestampType || "";
  if (timestampLabel) {
    parts.push(`${timestampLabel} · ${typeLabel}`);
  } else {
    parts.push(typeLabel);
  }

  return parts.join(" — ");
}

export async function scheduleNotificationsFromServer(
  response: NotificationsResponse,
): Promise<number> {
  if (Platform.OS === "web") return 0;

  const enabled = await getNotificationsEnabled();
  if (!enabled) return 0;

  // Avoid prompting for permissions during background/auto sync.
  const hasPermission = await hasNotificationPermission();
  if (!hasPermission) return 0;

  const now = new Date();

  // Sort by notifyAt so we prioritize the soonest notifications if we hit platform limits.
  const desired = response.notifications
    .map((notification, index) => {
      const notifyAt = new Date(notification.notifyAt);
      return { notification, index, notifyAt };
    })
    .filter((x) => Number.isFinite(x.notifyAt.getTime()))
    .filter((x) => x.notifyAt.getTime() >= now.getTime())
    .sort((a, b) => a.notifyAt.getTime() - b.notifyAt.getTime());

  // iOS has a hard limit (64) on scheduled local notifications.
  // Keep a little headroom to avoid edge cases and other notifications.
  const maxToSchedule = Platform.OS === "ios" ? 60 : Number.POSITIVE_INFINITY;
  const desiredLimited = desired.slice(0, maxToSchedule);

  // Update the set of active base notification IDs (used for foreground suppression).
  activeNotificationIds = new Set(
    desiredLimited.map((x) =>
      getNotificationIdentifier(x.notification, x.index),
    ),
  );
  activeIdsLoadedFromStorage = true;
  hasKnownActiveIds = true;
  try {
    await AsyncStorage.setItem(
      ACTIVE_NOTIFICATION_IDS_KEY,
      JSON.stringify(Array.from(activeNotificationIds)),
    );
  } catch {
    // Ignore storage failures; in-memory set still helps while app is running.
  }

  // Incremental sync: cancel only what we don't want, schedule only what we’re missing.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const existingIds = new Set(existing.map((n) => n.identifier));

  const desiredIds = new Set(
    desiredLimited.map((x) => {
      const baseId = getNotificationIdentifier(x.notification, x.index);
      return `${baseId}:${x.notifyAt.getTime()}`;
    }),
  );

  // Cancel obsolete scheduled notifications.
  for (const existingNotification of existing) {
    if (!desiredIds.has(existingNotification.identifier)) {
      try {
        await Notifications.cancelScheduledNotificationAsync(
          existingNotification.identifier,
        );
      } catch {
        // Ignore cancellation failures.
      }
    }
  }

  // Schedule missing notifications.
  for (const { notification, index, notifyAt } of desiredLimited) {
    const identifier = `${getNotificationIdentifier(notification, index)}:${notifyAt.getTime()}`;
    if (existingIds.has(identifier)) continue;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: formatNotificationBody(notification),
          data: {
            id: notification.id,
            file: notification.file,
            pos: notification.pos,
            type: notification.type,
            timestampType: notification.timestampType,
            eventTime: notification.eventTime,
            minutesBefore: notification.minutesBefore,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notifyAt,
        },
        identifier,
      });
    } catch (err) {
      console.error(
        `[Notifications] Failed to schedule ${notification.title}:`,
        err,
      );
    }
  }

  // Record sync time
  await AsyncStorage.setItem(LAST_SYNC_KEY, now.toISOString());

  return desiredLimited.length;
}

export async function getLastSyncTime(): Promise<Date | null> {
  const value = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return value ? new Date(value) : null;
}

export async function getScheduledNotificationCount(): Promise<number> {
  if (Platform.OS === "web") return 0;
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  return notifications.length;
}

export interface ScheduledNotificationInfo {
  identifier: string;
  title: string;
  body: string;
  scheduledTime: Date;
  id?: string;
  file?: string;
  pos?: number;
  type?: string;
  timestampType?: string;
  eventTime?: Date;
  minutesBefore?: number;
}

export async function getAllScheduledNotifications(): Promise<
  ScheduledNotificationInfo[]
> {
  if (Platform.OS === "web") return [];
  const notifications = await Notifications.getAllScheduledNotificationsAsync();

  const result: ScheduledNotificationInfo[] = [];

  for (const notification of notifications) {
    const trigger = notification.trigger as { value?: number; date?: Date };
    let scheduledTime: Date;
    if (trigger.date) {
      scheduledTime = new Date(trigger.date);
    } else if (trigger.value) {
      scheduledTime = new Date(trigger.value);
    } else {
      continue;
    }

    const data = notification.content.data as {
      id?: string;
      file?: string;
      pos?: number;
      type?: string;
      timestampType?: string;
      eventTime?: string;
      minutesBefore?: number;
    };

    result.push({
      identifier: notification.identifier,
      title: (notification.content.title as string) || "Notification",
      body: (notification.content.body as string) || "",
      scheduledTime,
      id: data?.id,
      file: data?.file,
      pos: data?.pos,
      type: data?.type,
      timestampType: data?.timestampType,
      eventTime: data?.eventTime ? new Date(data.eventTime) : undefined,
      minutesBefore: data?.minutesBefore,
    });
  }

  return result.sort(
    (a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime(),
  );
}

// Store for active notification identifiers (updated on each sync)
let activeNotificationIds: Set<string> = new Set();

export function updateActiveNotificationIds(
  notifications: ServerNotification[],
): void {
  activeNotificationIds = new Set(
    notifications.map((n, i) => getNotificationIdentifier(n, i)),
  );
  activeIdsLoadedFromStorage = true;
  hasKnownActiveIds = true;
}

export function isNotificationActive(identifier: string): boolean {
  // Extract the base ID (before the timestamp suffix)
  const parts = identifier.split(":");
  // Handle both "id:timestamp" and "file:pos:timestamp" formats
  const baseId = parts.length > 2 ? parts.slice(0, -1).join(":") : parts[0];
  return activeNotificationIds.has(baseId);
}

function getLocalDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function getBaseIdFromIdentifier(identifier: string): string {
  const parts = identifier.split(":");
  // Handle both "id:timestamp" and "file:pos:timestamp" formats
  return parts.length > 2 ? parts.slice(0, -1).join(":") : parts[0];
}

export async function cancelScheduledNotificationsForTodoOnDate(
  todo: { id?: string | null; file?: string | null; pos?: number | null },
  date: Date,
): Promise<number> {
  if (Platform.OS === "web") return 0;

  const { start, end } = getLocalDayBounds(date);
  const todoBaseId =
    todo.id ??
    (todo.file && todo.pos != null ? `${todo.file}:${todo.pos}` : null);

  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  let canceled = 0;

  for (const n of notifications) {
    const trigger = n.trigger as { value?: number; date?: Date };
    const scheduledTime = trigger?.date
      ? new Date(trigger.date)
      : trigger?.value
        ? new Date(trigger.value)
        : null;
    if (!scheduledTime) continue;
    if (scheduledTime < start || scheduledTime >= end) continue;

    const data = (n.content?.data ?? {}) as {
      id?: string;
      file?: string;
      pos?: number;
    };

    const matchesByData =
      (todo.id && data.id === todo.id) ||
      (!todo.id &&
        todo.file &&
        todo.pos != null &&
        data.file === todo.file &&
        data.pos === todo.pos);

    const matchesByIdentifier =
      todoBaseId != null &&
      getBaseIdFromIdentifier(n.identifier) === todoBaseId;

    if (!matchesByData && !matchesByIdentifier) continue;

    try {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
      canceled++;
    } catch {
      // Ignore.
    }
  }

  return canceled;
}
