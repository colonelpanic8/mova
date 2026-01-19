# Time Toggle for Swipe Actions

## Overview

Add a global "include time" toggle to todo list screens that modifies swipe action behavior to include time selection for scheduled and deadline dates.

## Scope

- Todo list screens with swipe actions only
- Capture screen already has time support (no changes needed)

## Toggle Behavior

- Located in screen header/toolbar area
- Single toggle affects all date-related swipe actions: Today, Tomorrow, Schedule, Deadline
- State persisted to AsyncStorage (`@mova/includeTimeToggle`)
- Default: OFF for first-time users

## Interaction Flow

### Toggle OFF (current behavior)

| Action | Result |
|--------|--------|
| Today | Immediately sets `YYYY-MM-DD` (today) |
| Tomorrow | Immediately sets `YYYY-MM-DD` (tomorrow) |
| Schedule | Opens date picker modal, sets `YYYY-MM-DD` |
| Deadline | Opens date picker modal, sets `YYYY-MM-DD` |

### Toggle ON

| Action | Result |
|--------|--------|
| Today | Swipe area expands with inline time picker, sets `YYYY-MM-DD HH:MM` |
| Tomorrow | Swipe area expands with inline time picker, sets `YYYY-MM-DD HH:MM` |
| Schedule | Date picker modal includes time picker, sets `YYYY-MM-DD HH:MM` |
| Deadline | Date picker modal includes time picker, sets `YYYY-MM-DD HH:MM` |

### Inline Time Picker Behavior

1. When Today/Tomorrow tapped with toggle ON, swipe area content changes to show time picker
2. Default time pre-filled (e.g., current hour rounded to next 15 min)
3. User adjusts time and taps "Confirm" or "Cancel"
4. On confirm: applies date+time, closes swipeable
5. On cancel: returns to normal action buttons

## Files to Modify

1. **`components/TodoItem.tsx`**
   - Accept `includeTime` prop from parent
   - Modify `renderRightActions` to handle expanded state for inline time picker
   - Add local state for "awaiting time input" after Today/Tomorrow tap

2. **`hooks/useTodoEditing.tsx`**
   - Modify `scheduleToday()` and `scheduleTomorrow()` to accept optional time parameter
   - Use `YYYY-MM-DD HH:MM` format when time provided

3. **Screen files (`app/(tabs)/index.tsx`, `app/(tabs)/views.tsx`, etc.)**
   - Add toggle state management (load from AsyncStorage, save on change)
   - Render toggle in header
   - Pass `includeTime` to TodoItem components

4. **Modals (Schedule/Deadline pickers)**
   - Add time picker when `includeTime` is true
   - Reuse formatting logic from capture screen's `formatDateTimeForApi`

## New Components

- **`components/InlineTimePicker.tsx`** - Simple hour:minute selector for swipe area expansion

## Date Formats

- Date only: `2026-01-19`
- With time: `2026-01-19 14:30`

Reuse existing `formatDateTimeForApi` pattern from capture.tsx.
