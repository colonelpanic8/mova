# Notification Support Design

## Overview

Add notification support to mova that mirrors org-wild-notifier.el behavior. Uses the same `WILD_NOTIFIER_NOTIFY_BEFORE` property for per-item notification times.

## API Changes (org-agenda-api.el)

### Modified `/get-all-todos` Response

Wrap response with defaults and add `notifyBefore` field to each todo:

```json
{
  "defaults": {
    "notifyBefore": [10]
  },
  "todos": [
    {
      "title": "Meeting with Bob",
      "todo": "TODO",
      "scheduled": "2024-01-12T14:00:00Z",
      "deadline": null,
      "notifyBefore": [10, 30, 60],
      ...
    }
  ]
}
```

- `defaults.notifyBefore`: From `org-wild-notifier-alert-time` variable
- `todo.notifyBefore`: From `WILD_NOTIFIER_NOTIFY_BEFORE` property (null if not set)

### Implementation

1. Read `org-wild-notifier-alert-time` for defaults
2. Extract `WILD_NOTIFIER_NOTIFY_BEFORE` property in todo extraction
3. Parse comma/space separated minutes into array

## Mobile App Changes

### Dependencies

- `expo-notifications` - Local notification scheduling
- `expo-background-fetch` - Periodic background sync
- `expo-task-manager` - Background task registration

### New Files

- `services/notifications.ts` - Notification scheduling logic
- `hooks/useNotificationSync.ts` - Sync on app focus

### Sync Flow

On every sync (foreground or background):

1. Fetch `/get-all-todos`
2. Cancel ALL scheduled notifications
3. For each todo with scheduled/deadline:
   - Get notify times: `todo.notifyBefore ?? defaults.notifyBefore`
   - For each notify time, if notification time is in future:
     - Schedule local notification
4. Store todos in AsyncStorage for reference

### Notification Content

- Title: Todo title
- Body: "In X minutes" or time of event
- Tap: Opens app (future: deep link to todo)

### Background Sync

- Register background fetch task
- iOS: Minimum ~15 min interval (system controlled)
- Android: More flexible, can request specific intervals
- Task: Sync todos and reschedule notifications

### Permissions

- Request on first sync attempt
- If denied, show explanation in Settings tab
- Provide toggle to enable/disable notifications

### Edge Cases

- Skip done items (DONE, CANCELLED, etc.)
- Skip notifications where time has passed
- Unique notification ID: `{todoId}:{notifyMinutes}` or `{file}:{pos}:{notifyMinutes}`
