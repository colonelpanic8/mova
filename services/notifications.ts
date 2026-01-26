import { formatTimeFromDate, formatTimeUntil } from "@/utils/timeFormatting";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { NotificationsResponse, ServerNotification } from "./api";

const NOTIFICATIONS_ENABLED_KEY = "notifications_enabled";
const LAST_SYNC_KEY = "last_notification_sync";

// Configure how notifications are displayed when app is in foreground (native only)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
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
  }
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function getNotificationIdentifier(notification: ServerNotification): string {
  return notification.id || `${notification.file}:${notification.pos}`;
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

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return 0;

  // Cancel ALL existing notifications - server is source of truth
  await cancelAllNotifications();

  const now = new Date();

  // Update the set of active notification IDs
  updateActiveNotificationIds(response.notifications);

  let scheduledCount = 0;

  for (const notification of response.notifications) {
    const notifyAt = new Date(notification.notifyAt);

    // Skip if notification time has passed
    if (notifyAt <= now) continue;

    const identifier = `${getNotificationIdentifier(notification)}:${notifyAt.getTime()}`;

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
      scheduledCount++;
    } catch (err) {
      console.error(
        `Failed to schedule notification for ${notification.title}:`,
        err,
      );
    }
  }

  // Record sync time
  await AsyncStorage.setItem(LAST_SYNC_KEY, now.toISOString());

  return scheduledCount;
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
    notifications.map((n) => getNotificationIdentifier(n)),
  );
}

export function isNotificationActive(identifier: string): boolean {
  // Extract the base ID (before the timestamp suffix)
  const parts = identifier.split(":");
  // Handle both "id:timestamp" and "file:pos:timestamp" formats
  const baseId = parts.length > 2 ? parts.slice(0, -1).join(":") : parts[0];
  return activeNotificationIds.has(baseId);
}
