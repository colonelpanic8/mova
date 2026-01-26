# Notification Backend Issue: Missing Identifier Fields

## Problem

The backend `/notifications` endpoint is not always including `id`, `file`, or `pos` in notification responses. This prevents the client from uniquely identifying notifications.

## Expected Behavior

Per the `ServerNotification` interface, each notification should include:

- `file: string` (required) - source org file path
- `pos: number` (required) - position in file
- `id?: string` (optional) - org-mode ID property

## Current Workaround

The client has a fallback in `services/notifications.ts:56-63`:

```typescript
function getNotificationIdentifier(
  notification: ServerNotification,
  index: number,
): string {
  if (notification.id) return notification.id;
  if (notification.file && notification.pos != null) {
    return `${notification.file}:${notification.pos}`;
  }
  return `notif-${index}`; // Fallback when backend omits identifiers
}
```

## Impact

Index-based identifiers are fragile - if the notification order changes between syncs, the wrong notifications may be cancelled or duplicated.

## Fix Required

The backend should include `file` and `pos` for every notification in the response. These values should come from the org-mode heading that generated the notification.
