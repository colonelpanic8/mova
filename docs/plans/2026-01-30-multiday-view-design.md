# Multi-day View Design

## Overview

Replace the fixed "Week" view (Sun-Sat, 7 days) with a configurable "Multi-day" view that allows users to set the range length and how many days of past/future to show by default.

## Requirements

1. **Flexible start date** - Date picker selects the start of the range directly (not a date whose containing week is shown)
2. **Configurable range** - User can configure:
   - Total range length (default: 7 days)
   - Days of past to include (default: 1)
   - Future days derived automatically: `rangeLength - pastDays - 1`
3. **"Go to Today"** resets to configured defaults (today - pastDays as start)

## Settings Schema

New settings in `SettingsContext`:

```typescript
multiDayRangeLength: number; // Total days in range (default: 7, min: 2, max: 14)
multiDayPastDays: number; // Days before today (default: 1, min: 0, max: rangeLength-1)
```

**Validation:**

- `pastDays` must be less than `rangeLength`
- If user increases `pastDays` beyond valid range, cap it automatically

## Date Calculation Logic

```typescript
// When "Go to Today" is pressed or app loads:
function getDefaultRangeStart(today: Date, pastDays: number): Date {
  const start = new Date(today);
  start.setDate(start.getDate() - pastDays);
  return start;
}

// Range end calculation:
function getRangeEnd(startDate: Date, rangeLength: number): Date {
  const end = new Date(startDate);
  end.setDate(end.getDate() + rangeLength - 1);
  return end;
}
```

**Navigation:**

- Previous/Next buttons move by `rangeLength` days
- Selecting a date in picker sets that date as range start
- "Go to Today" calculates start from `today - pastDays`

**API call:**

- Use `getAgenda("custom", startDate, ..., endDate)` instead of `getAgenda("week", ...)`

## UI Changes

### Renamed Labels

- Menu option: "Week" → "Multi-day"
- View mode type in code: `"week"` → `"multiday"`

### Date Header

- Keep existing "Jan 1 - Jan 7" format with dynamic range
- Tapping opens date picker
- Selected date becomes range **start**

### Navigation

- Chevrons move by `rangeLength` days
- "Go to Today" resets to default range

### Settings Screen

New "Multi-day View" section with:

- **Range length** - Stepper (2-14, default 7)
- **Days before today** - Stepper (0 to rangeLength-1, default 1)
- Helper text: "Days after today: X" (computed, read-only)

## Migration & Edge Cases

### Backward Compatibility

- Existing users get defaults: length=7, pastDays=1
- Handle stored `"week"` view mode as `"multiday"`

### Edge Cases

1. **Settings changed mid-session** - Recalculate from current start date with new length
2. **Past days exceeds range** - Auto-cap pastDays to (rangeLength - 1)
3. **API** - Already supports custom date ranges, no backend changes

## Files to Modify

| File                            | Changes                                                |
| ------------------------------- | ------------------------------------------------------ |
| `context/SettingsContext.tsx`   | Add `multiDayRangeLength`, `multiDayPastDays` settings |
| `services/settings.ts`          | Add storage keys for new settings                      |
| `app/(tabs)/index.tsx`          | Update view mode, navigation, date calculations        |
| `app/(tabs)/settings/index.tsx` | Add Multi-day View settings section                    |
| `utils/filterTodos.ts`          | Update any "week" references if applicable             |
