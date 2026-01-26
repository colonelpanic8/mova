# Notifications Redesign: Server as Source of Truth

## Overview

Replace client-side notification scheduling logic with server-driven notifications using the new `/notifications` endpoint from org-agenda-api. The server owns all notification state; the client simply schedules what the server returns.

## Goals

1. **Better notification data** - Richer information from backend
2. **Reduce client complexity** - Remove client-side filtering and time calculation
3. **New notification types** - Support for absolute and day-wide notifications (not just relative)
4. **Performance** - Fetch only notifications, not all todos

## New API Endpoint

`GET /notifications`

```typescript
interface NotificationsResponse {
  count: number;
  withinMinutes: number | null;
  defaultNotifyBefore: number[];
  notifications: ServerNotification[];
}

interface ServerNotification {
  title: string;
  notifyAt: string;  // ISO 8601 - when to fire notification
  type: "relative" | "absolute" | "day-wide";

  // For relative notifications
  timestampType?: "deadline" | "scheduled" | "timestamp";
  eventTime?: string;       // ISO 8601 - when event happens
  eventTimeString?: string; // Original org timestamp
  minutesBefore?: number;

  // Location/identity
  file: string;
  pos: number;
  id?: string;  // org ID if set

  // Context
  allTimes?: Array<{timestampType: string; timestampString: string}>;
}
```

No `within` parameter needed - fetch all notifications and schedule everything.

## Core Sync Logic

1. Call `api.getNotifications()`
2. Cancel ALL currently scheduled expo notifications
3. Schedule a new local notification for each item using `notifyAt` as trigger time
4. Use `id` (org ID) as notification identifier if available, otherwise `file:pos`

### Sync Triggers

- Manual refresh button
- Background fetch (~15 min intervals)
- When notifications are enabled
- App comes to foreground

### Pre-fire Verification

When a notification is about to display (via `NotificationReceivedListener`):

1. Quick fetch to `/notifications`
2. Check if notification with matching identifier exists
3. If found OR fetch fails → show notification
4. If fetch succeeds but notification missing → suppress it

This only works when app is foregrounded/background, not killed. Acceptable as best-effort optimization.

## UI Changes

### Notifications List Screen

- **Remove:** Delete/cancel button for individual notifications (server owns state)
- **Keep:** Manual refresh button, enable/disable toggle, notification list
- **Add:** Display `type` and `timestampType` with label + icon

Display format example: Icon + "deadline · relative" or "scheduled · day-wide"

### Custom Reminders

Keep the feature but ensure it sets the appropriate property (`WILD_NOTIFIER_NOTIFY_AT`) on the org entry via API. The next sync will pick it up from the server.

## Files to Modify

### Core Changes

- `services/api.ts` - Add `getNotifications()` method and types
- `services/notifications.ts` - Replace scheduling logic, add pre-fire verification
- `hooks/useNotificationSync.ts` - Simplify to call new sync function
- `services/backgroundSync.ts` - Update to use new sync
- `app/(tabs)/settings/notifications.tsx` - Remove delete button, add type/timestampType display

### Potential Changes

- `app/edit.tsx` - Verify custom reminder sets property via API

### Remove/Deprecate

- Todo filtering logic for notifications
- Client-side notification time calculation from `notifyBefore` arrays
- `getAllTodos()` usage specifically for notifications

## Migration

No data migration needed. On first sync after update:
1. All old scheduled notifications get cancelled
2. New notifications scheduled from server response

Users may see a brief period with no notifications between update and first sync.
