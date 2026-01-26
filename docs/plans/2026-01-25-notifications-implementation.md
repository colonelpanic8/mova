# Notifications Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace client-side notification scheduling with server-driven notifications from `/notifications` endpoint.

**Architecture:** Server is source of truth. On each sync: cancel all local notifications, schedule exactly what server returns. Pre-fire verification checks notification still exists before showing.

**Tech Stack:** React Native, Expo Notifications, TypeScript, expo-background-fetch

---

## Task 1: Add API Types and Method

**Files:**
- Modify: `services/api.ts:130-138` (add new types after existing notification types)
- Modify: `services/api.ts:395-398` (add new method after getAllTodos)
- Test: `tests/unit/api.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/api.test.ts` after the `getAllTodos` describe block:

```typescript
describe("getNotifications", () => {
  it("should make GET request to /notifications", async () => {
    const mockResponse = {
      count: 2,
      withinMinutes: null,
      defaultNotifyBefore: [10, 30],
      notifications: [
        {
          title: "Test Task",
          notifyAt: "2026-01-25T10:00:00",
          type: "relative",
          timestampType: "deadline",
          eventTime: "2026-01-25T10:30:00",
          minutesBefore: 30,
          file: "/test.org",
          pos: 100,
          id: "test-id",
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const result = await api.getNotifications();

    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-api.local/notifications",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic"),
        }),
      }),
    );
    expect(result).toEqual(mockResponse);
    expect(result.notifications[0].type).toBe("relative");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=api.test.ts --testNamePattern="getNotifications"`
Expected: FAIL with "api.getNotifications is not a function"

**Step 3: Add types to api.ts**

Add after line 132 (after `NotificationDefaults` interface):

```typescript
export type NotificationType = "relative" | "absolute" | "day-wide";
export type TimestampType = "deadline" | "scheduled" | "timestamp";

export interface ServerNotification {
  title: string;
  notifyAt: string;
  type: NotificationType;
  timestampType?: TimestampType;
  eventTime?: string;
  eventTimeString?: string;
  minutesBefore?: number;
  file: string;
  pos: number;
  id?: string;
  allTimes?: Array<{ timestampType: string; timestampString: string }>;
}

export interface NotificationsResponse {
  count: number;
  withinMinutes: number | null;
  defaultNotifyBefore: number[];
  notifications: ServerNotification[];
}
```

**Step 4: Add getNotifications method**

Add after `getAllTodos` method (around line 398):

```typescript
async getNotifications(): Promise<NotificationsResponse> {
  return this.request<NotificationsResponse>("/notifications");
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --testPathPattern=api.test.ts --testNamePattern="getNotifications"`
Expected: PASS

**Step 6: Commit**

```bash
git add services/api.ts tests/unit/api.test.ts
git commit -m "feat(api): add getNotifications method for server-driven notifications"
```

---

## Task 2: Rewrite Notification Scheduling Logic

**Files:**
- Modify: `services/notifications.ts` (replace `scheduleNotificationsForTodos` with new function)

**Step 1: Add new scheduling function**

Replace the `scheduleNotificationsForTodos` function and related code. Keep the imports and helper functions, but add/replace:

```typescript
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
  if (notification.type === "relative" && notification.minutesBefore && notification.eventTime) {
    const eventDate = new Date(notification.eventTime);
    parts.push(`${formatTimeUntil(notification.minutesBefore)} at ${formatTimeFromDate(eventDate)}`);
  }

  // Add type label
  const typeLabel = notification.type === "day-wide" ? "day-wide" : notification.type;
  const timestampLabel = notification.timestampType || "";
  if (timestampLabel) {
    parts.push(`${timestampLabel} \u00b7 ${typeLabel}`);
  } else {
    parts.push(typeLabel);
  }

  return parts.join(" \u2014 ");
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
```

**Step 2: Run existing tests**

Run: `npm test`
Expected: All tests pass (no notification-specific tests exist yet)

**Step 3: Commit**

```bash
git add services/notifications.ts
git commit -m "refactor(notifications): replace todo-based scheduling with server-driven approach"
```

---

## Task 3: Update useNotificationSync Hook

**Files:**
- Modify: `hooks/useNotificationSync.ts`

**Step 1: Update the hook to use new API**

Replace the entire file:

```typescript
import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { registerBackgroundSync } from "@/services/backgroundSync";
import {
  getLastSyncTime,
  getNotificationsEnabled,
  getScheduledNotificationCount,
  scheduleNotificationsFromServer,
} from "@/services/notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

export function useNotificationSync() {
  const { isAuthenticated } = useAuth();
  const api = useApi();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncNotifications = useCallback(async () => {
    if (!isAuthenticated || !api) return;

    const enabled = await getNotificationsEnabled();
    if (!enabled) return;

    setIsSyncing(true);
    try {
      const response = await api.getNotifications();
      const count = await scheduleNotificationsFromServer(response);

      setScheduledCount(count);
      setLastSync(new Date());
    } catch (err) {
      console.error("Notification sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, api]);

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
    syncNotifications,
  };
}
```

**Step 2: Commit**

```bash
git add hooks/useNotificationSync.ts
git commit -m "refactor(useNotificationSync): use getNotifications endpoint"
```

---

## Task 4: Update Background Sync

**Files:**
- Modify: `services/backgroundSync.ts`

**Step 1: Update background task to use new API**

Replace the task definition section (inside the setTimeout callback, around lines 61-87):

```typescript
TM.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const enabled = await getNotificationsEnabled();
    if (!enabled) {
      return BF.BackgroundFetchResult.NoData;
    }

    const { apiUrl, username, password } = await getStoredCredentials();
    if (!apiUrl || !username || !password) {
      return BF.BackgroundFetchResult.NoData;
    }

    const api = createApiClient(apiUrl, username, password);
    const response = await api.getNotifications();

    const count = await scheduleNotificationsFromServer(response);
    console.log(`Background sync: scheduled ${count} notifications`);

    return BF.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error("Background sync failed:", err);
    return BF.BackgroundFetchResult.Failed;
  }
});
```

Also update the import at the top of the setTimeout callback:

```typescript
const { getNotificationsEnabled, scheduleNotificationsFromServer } =
  await import("./notifications");
```

**Step 2: Commit**

```bash
git add services/backgroundSync.ts
git commit -m "refactor(backgroundSync): use getNotifications endpoint"
```

---

## Task 5: Update Notifications UI Screen

**Files:**
- Modify: `app/(tabs)/settings/notifications.tsx`

**Step 1: Remove cancel functionality and add type/timestampType display**

Replace the entire file:

```typescript
import { useNotificationSync } from "@/hooks/useNotificationSync";
import {
  getAllScheduledNotifications,
  ScheduledNotificationInfo,
} from "@/services/notifications";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Icon,
  List,
  Text,
  useTheme,
} from "react-native-paper";

function formatScheduledTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 0) return "Past";
  if (diffMins < 1) return "Less than 1 min";
  if (diffMins < 60) return `In ${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    const remainingMins = diffMins % 60;
    if (remainingMins === 0) return `In ${diffHours}h`;
    return `In ${diffHours}h ${remainingMins}m`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;

  return date.toLocaleDateString();
}

function formatFullDateTime(date: Date): string {
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTypeIcon(type?: string): string {
  switch (type) {
    case "relative":
      return "clock-outline";
    case "absolute":
      return "clock-check-outline";
    case "day-wide":
      return "calendar-today";
    default:
      return "bell-outline";
  }
}

function getTimestampTypeIcon(timestampType?: string): string {
  switch (timestampType) {
    case "deadline":
      return "flag-outline";
    case "scheduled":
      return "calendar-clock";
    case "timestamp":
      return "calendar";
    default:
      return "";
  }
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const [notifications, setNotifications] = useState<
    ScheduledNotificationInfo[]
  >([]);
  const [loading, setLoading] = useState(true);
  const { syncNotifications, isSyncing } = useNotificationSync();

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const notifs = await getAllScheduledNotifications();
      setNotifications(notifs);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = useCallback(async () => {
    await syncNotifications();
    await loadNotifications();
  }, [syncNotifications, loadNotifications]);

  if (loading) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text variant="titleMedium">
          {notifications.length} scheduled notification
          {notifications.length !== 1 ? "s" : ""}
        </Text>
        <Button
          mode="text"
          onPress={handleRefresh}
          loading={isSyncing}
          disabled={isSyncing}
          icon="refresh"
          compact
        >
          Refresh
        </Button>
      </View>

      <Divider />

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <List.Icon icon="bell-off-outline" />
          <Text variant="bodyLarge" style={styles.emptyText}>
            No scheduled notifications
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.emptySubtext, { color: theme.colors.outline }]}
          >
            Notifications will appear here when you have upcoming reminders
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {notifications.map((notification) => (
            <Card
              key={notification.identifier}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              mode="contained"
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardMain}>
                  <Text
                    variant="titleSmall"
                    numberOfLines={2}
                    style={styles.notificationTitle}
                  >
                    {notification.title}
                  </Text>
                  <View style={styles.typeRow}>
                    {notification.timestampType && (
                      <Chip
                        icon={() => (
                          <Icon
                            source={getTimestampTypeIcon(notification.timestampType)}
                            size={14}
                            color={theme.colors.onSurfaceVariant}
                          />
                        )}
                        compact
                        style={styles.chip}
                        textStyle={styles.chipText}
                      >
                        {notification.timestampType}
                      </Chip>
                    )}
                    {notification.type && (
                      <Chip
                        icon={() => (
                          <Icon
                            source={getTypeIcon(notification.type)}
                            size={14}
                            color={theme.colors.onSurfaceVariant}
                          />
                        )}
                        compact
                        style={styles.chip}
                        textStyle={styles.chipText}
                      >
                        {notification.type}
                      </Chip>
                    )}
                  </View>
                  <View style={styles.timeRow}>
                    <Text
                      variant="labelMedium"
                      style={{ color: theme.colors.primary }}
                    >
                      {formatScheduledTime(notification.scheduledTime)}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.outline }}
                    >
                      {formatFullDateTime(notification.scheduledTime)}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 48,
  },
  emptyText: {
    marginTop: 16,
  },
  emptySubtext: {
    marginTop: 8,
    textAlign: "center",
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  card: {
    marginBottom: 0,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardMain: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontWeight: "600",
  },
  typeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  chip: {
    height: 24,
  },
  chipText: {
    fontSize: 11,
    marginVertical: 0,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
});
```

**Step 2: Commit**

```bash
git add app/\(tabs\)/settings/notifications.tsx
git commit -m "refactor(notifications-ui): remove cancel button, add type/timestampType chips"
```

---

## Task 6: Add Pre-fire Verification

**Files:**
- Modify: `services/notifications.ts` (add verification listener)
- Modify: `hooks/useNotificationSync.ts` (set up listener)

**Step 1: Add verification function to notifications.ts**

Add at the end of `services/notifications.ts`:

```typescript
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
```

Also update `scheduleNotificationsFromServer` to call `updateActiveNotificationIds`:

After the line `const now = new Date();` add:

```typescript
// Update the set of active notification IDs
updateActiveNotificationIds(response.notifications);
```

**Step 2: Add listener setup to useNotificationSync**

Update `hooks/useNotificationSync.ts` to add the verification listener:

```typescript
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
  const verificationInProgress = useRef(false);

  const syncNotifications = useCallback(async () => {
    if (!isAuthenticated || !api) return;

    const enabled = await getNotificationsEnabled();
    if (!enabled) return;

    setIsSyncing(true);
    try {
      const response = await api.getNotifications();
      const count = await scheduleNotificationsFromServer(response);

      setScheduledCount(count);
      setLastSync(new Date());
    } catch (err) {
      console.error("Notification sync failed:", err);
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
    syncNotifications,
  };
}
```

**Step 3: Commit**

```bash
git add services/notifications.ts hooks/useNotificationSync.ts
git commit -m "feat(notifications): add pre-fire verification to dismiss stale notifications"
```

---

## Task 7: Clean Up Unused Code

**Files:**
- Modify: `services/notifications.ts` (remove old scheduling function)
- Modify: `services/api.ts` (keep getAllTodos as it may be used elsewhere)

**Step 1: Remove old function from notifications.ts**

Remove the old `scheduleNotificationsForTodos` function and the `DONE_STATES` constant since they are no longer needed. Also remove the `cancelNotification` export and the `scheduleCustomNotification` function (custom reminders should go through the server).

After cleanup, the file should not export:
- `scheduleNotificationsForTodos`
- `cancelNotification`
- `scheduleCustomNotification`

Keep the old `Todo` import removal - update imports at the top of the file:

```typescript
import { formatTimeFromDate, formatTimeUntil } from "@/utils/timeFormatting";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { NotificationsResponse, ServerNotification } from "./api";
```

**Step 2: Verify no import errors**

Run: `npm run lint`
Expected: No errors about missing imports

**Step 3: Commit**

```bash
git add services/notifications.ts
git commit -m "refactor(notifications): remove unused todo-based scheduling functions"
```

---

## Task 8: Update Nix Flake and Test

**Step 1: Update org-agenda-api**

Run: `nix flake update`

**Step 2: Run the app and verify**

Run: `npm start` and test on device/simulator:
- Enable notifications in settings
- Verify notifications list shows type/timestampType chips
- Verify refresh works
- Verify no cancel button exists

**Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Final commit**

```bash
git add flake.lock
git commit -m "chore: update flake.lock for new org-agenda-api notifications endpoint"
```

---

## Summary

This plan implements:
1. New `getNotifications()` API method
2. Server-driven notification scheduling
3. Removal of client-side notification time calculation
4. Pre-fire verification to dismiss stale notifications
5. UI updates with type/timestampType chips
6. Removal of cancel button (server owns state)
