# Habit Cell Scaling Implementation

## Goal

Scale habit graph cells based on assessment interval duration so that visual width represents actual time.

## Changes

### 1. Extend MiniGraphEntry interface (services/api.ts)

Add `assessmentStart` and `assessmentEnd` fields:

```typescript
export interface MiniGraphEntry {
  date: string;
  assessmentStart?: string; // NEW
  assessmentEnd?: string; // NEW
  conformingRatio: number;
  completed: boolean;
  completionNeededToday?: boolean;
}
```

### 2. Update transformGraphData (components/HabitItem.tsx)

Pass through the assessment period info:

```typescript
assessmentStart: entry.assessmentStart,
assessmentEnd: entry.assessmentEnd,
```

### 3. Update HabitGraph.tsx

#### Calculate interval duration

```typescript
function getIntervalDays(entry: MiniGraphEntry): number {
  if (!entry.assessmentStart || !entry.assessmentEnd) return 1;
  const start = new Date(entry.assessmentStart);
  const end = new Date(entry.assessmentEnd);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}
```

#### Calculate cell width multiplier

- 1-14 days: proportional width (7 days = 7x width)
- 15-31 days (monthly): 2.5x width
- 32+ days: 3x width

#### Update cell label

- 1 day: show day number (current behavior)
- 2-14 days: show "16-22" range
- Monthly: show month abbreviation "Jan"

### 4. Update GraphCell component

- Accept `intervalDays` prop
- Calculate dynamic width
- Format label based on interval type
