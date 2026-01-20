# Completed Todos Frontend

## Overview

Add frontend support for showing completed todos in the agenda view, consuming the new `include_completed` parameter and `completedAt` field from the backend API.

## Design Decisions

- **Toggle location**: Dedicated icon button in header next to refresh
- **Default state**: ON for past days, OFF for today/future
- **Visual treatment**: Muted opacity (60%), no strikethrough
- **Grouping**: Completed items in separate section at bottom with "Completed" divider
- **Completion time**: Displayed in meta row as "Completed at 2:30 PM"

## Implementation

### 1. API Changes (`services/api.ts`)

- Add `completedAt?: string | null` to `AgendaEntry` interface
- Update `getAgenda()` signature:
  ```typescript
  async getAgenda(
    span: "day" | "week" = "day",
    date?: string,
    includeOverdue?: boolean,
    includeCompleted?: boolean,
  ): Promise<AgendaResponse>
  ```
- Pass `include_completed` query parameter when `includeCompleted` is true

### 2. Toggle Button (`app/(tabs)/index.tsx`)

- Add `showCompleted` state, initialized based on whether date is past
- Reset state when date changes (past = on, today/future = off)
- Add icon button in header:
  - Icon: `check-circle-outline` (off) / `check-circle` (on)
  - Position: between date nav and refresh button

### 3. Section-Based List (`app/(tabs)/index.tsx`)

- Replace `FlatList` with `SectionList`
- Split entries into `activeEntries` and `completedEntries` based on `completedAt`
- Sections:
  - Active items: no header
  - Completed items: "Completed" divider header (only if items exist)

### 4. TodoItem Changes (`components/TodoItem.tsx`)

- Add optional `opacity` prop for parent to control item opacity
- Display `completedAt` in meta row when present, formatted as time

### 5. Behavior

- Date navigation resets toggle based on past/present logic
- Manual toggle persists until date changes
- Existing filters apply to both sections
- Empty state shows "No items for today" when no visible items
