import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { NotificationDefaults, Todo } from "./api";

const NOTIFICATIONS_ENABLED_KEY = "notifications_enabled";
const LAST_SYNC_KEY = "last_notification_sync";

// Done states that should not trigger notifications
const DONE_STATES = ["DONE", "CANCELLED", "CANCELED"];

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

function getTodoId(todo: Todo): string {
  return todo.id || `${todo.file}:${todo.pos}`;
}

function formatTimeUntil(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) return `in ${hours} hour${hours > 1 ? "s" : ""}`;
  return `in ${hours}h ${remainingMins}m`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export async function scheduleNotificationsForTodos(
  todos: Todo[],
  defaults: NotificationDefaults,
): Promise<number> {
  if (Platform.OS === "web") return 0;
  const enabled = await getNotificationsEnabled();
  if (!enabled) return 0;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return 0;

  // Cancel all existing notifications first
  await cancelAllNotifications();

  const now = new Date();
  let scheduledCount = 0;

  for (const todo of todos) {
    // Skip done items
    if (todo.todo && DONE_STATES.includes(todo.todo.toUpperCase())) {
      continue;
    }

    // Get the event time (scheduled or deadline)
    const eventTimeStr = todo.scheduled || todo.deadline;
    if (!eventTimeStr) continue;

    const eventTime = new Date(eventTimeStr);
    if (isNaN(eventTime.getTime())) continue;

    // Get notification times (per-item or defaults)
    const notifyMinutes = todo.notifyBefore || defaults.notifyBefore;
    if (!notifyMinutes || notifyMinutes.length === 0) continue;

    const todoId = getTodoId(todo);

    for (const minutes of notifyMinutes) {
      const notificationTime = new Date(
        eventTime.getTime() - minutes * 60 * 1000,
      );

      // Skip if notification time has passed
      if (notificationTime <= now) continue;

      // Schedule the notification
      const identifier = `${todoId}:${minutes}`;

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: todo.title,
            body: `${formatTimeUntil(minutes)} (${formatTime(eventTime)})`,
            data: {
              todoId,
              file: todo.file,
              pos: todo.pos,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: notificationTime,
          },
          identifier,
        });
        scheduledCount++;
      } catch (err) {
        console.error(
          `Failed to schedule notification for ${todo.title}:`,
          err,
        );
      }
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
  todoId?: string;
}

export async function getAllScheduledNotifications(): Promise<
  ScheduledNotificationInfo[]
> {
  if (Platform.OS === "web") return [];
  const notifications = await Notifications.getAllScheduledNotificationsAsync();

  const result: ScheduledNotificationInfo[] = [];

  for (const notification of notifications) {
    const trigger = notification.trigger as { value?: number; date?: Date };
    // Handle different trigger formats
    let scheduledTime: Date;
    if (trigger.date) {
      scheduledTime = new Date(trigger.date);
    } else if (trigger.value) {
      scheduledTime = new Date(trigger.value);
    } else {
      continue;
    }

    result.push({
      identifier: notification.identifier,
      title: (notification.content.title as string) || "Notification",
      body: (notification.content.body as string) || "",
      scheduledTime,
      todoId: (notification.content.data as { todoId?: string })?.todoId,
    });
  }

  return result.sort(
    (a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime(),
  );
}

export async function cancelNotification(identifier: string): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function scheduleCustomNotification(
  todo: {
    id?: string | null;
    file?: string | null;
    pos?: number | null;
    title: string;
  },
  notificationTime: Date,
): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  const todoId = todo.id || `${todo.file}:${todo.pos}`;
  const identifier = `${todoId}:custom:${notificationTime.getTime()}`;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: todo.title,
        body: `Reminder: ${formatTime(notificationTime)}`,
        data: {
          todoId,
          file: todo.file,
          pos: todo.pos,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notificationTime,
      },
      identifier,
    });
    return identifier;
  } catch (err) {
    console.error(
      `Failed to schedule custom notification for ${todo.title}:`,
      err,
    );
    return null;
  }
}
