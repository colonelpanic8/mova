# Habits Frontend Integration Design

**Date:** 2026-01-20
**Status:** Draft

## Overview

Integrate org-window-habit support into mova frontend with three capabilities:

1. **Inline habit display** - Habits in agenda/todo lists show a mini consistency graph. Tapping any habit's graph enters "graph mode" where all habits expand to full-width horizontally-scrollable graphs that scroll in sync.

2. **Dedicated habits screen** - A new tab showing all habits (regardless of scheduled date) with full graphs always visible. Summary stats at top showing today's completion count and conforming health.

3. **Filter toggle** - "Show habits" toggle in the filter modal. When off, habits are completely hidden from the agenda.

## Data Flow

- `/habit-config` fetched once at startup - provides colors for graph rendering
- `habitSummary` (with `miniGraph`) on each todo from `/agenda` and `/get-all-todos` - powers the inline mini-graph
- `/habit-status?id=X` fetched on-demand - provides full graph data for expanded mode and habits screen

## Color System

Colors fetched from `/habit-config`, with defaults:

| Color | Hex | Usage |
|-------|-----|-------|
| Conforming | `#4d7085` | Ratio = 1.0 (on track) |
| Not Conforming | `#d40d0d` | Ratio = 0.0 (behind) |
| Required Completion FG | `#000000` | Glyph color when completion matters |
| Non-Required Completion FG | `#FFFFFF` | Glyph color when completion optional |
| Required Today FG | `#00FF00` | Glyph color for today when needed |

Cell background colors are interpolated between not-conforming and conforming based on `conformingRatio` (0.0 to 1.0).

**Glyphs:**
- `☐` - Completion needed today (not yet done)
- `✓` - Completed

## Inline Habit Display (Collapsed State)

**Location:** Inside `TodoItem` component for items where `isWindowHabit: true`

**Layout:** Horizontal bar of colored cells below/beside the todo title.

**Content:**
- Past intervals: As many as fit in available width (~10-14 cells)
- Today: 1 cell
- Future: 0-1 cells

**Cell rendering:**
- Background: Lerp red → blue based on `conformingRatio`
- Glyph (today only): `☐` if completion needed, `✓` if completed, empty otherwise

**Data source:** `habitSummary.miniGraph` array included in todo response (no extra fetch needed).

## Graph Mode (Expanded State)

**Trigger:** Tap on any habit's mini-graph in the list

**Behavior:** All visible habits expand to show full consistency graphs.

**Layout:**
- Each habit row expands vertically
- Graph shows: 21 past + today (4 chars: `|☐ |`) + 4 future
- Horizontally scrollable
- All graphs scroll together (synchronized scroll position)
- Same dates align vertically across habits

**Exit graph mode:**
- Tap the graph area again
- Tap anywhere outside the graphs
- Explicit close button (appears in graph mode)

**Data source:** `/habit-status?id=X` for each visible habit, fetched when entering graph mode, cached.

**State:** `habitGraphMode: boolean` in context so all `TodoItem` components react together.

## Dedicated Habits Screen

**Location:** New tab in tab bar alongside Agenda, Views, Search, Capture, Settings.

### Top Section - Summary Stats

- "X habits remaining today" - count where `completionNeededToday: true` and not completed
- "X/Y habits on track" - count where `conformingRatio >= 1.0`

### Main Section - Habits List

- Shows all habits from `/get-all-todos` where `isWindowHabit: true`
- No date filtering - shows all habits regardless of scheduled date
- Always in expanded mode - full graphs visible (21 past + today + 4 future)
- Horizontally scrollable, all graphs scroll together

### Interactions

- Tap habit row → opens edit screen
- Swipe actions → same as regular todos (complete, schedule, etc.)
- Completing updates graph immediately

**Data source:**
- Fetch all todos, filter for `isWindowHabit: true`
- Fetch `/habit-status` for each habit for full graph data

## Filter Toggle

**Location:** `FilterModal` component, alongside existing filters.

**UI:** Toggle switch labeled "Show habits" (default: ON)

**Behavior when OFF:** Agenda and Views filter out todos where `isWindowHabit: true`

**State:** Stored in `FilterContext`, persisted to AsyncStorage.

**Note:** This filter only affects agenda/views. Habits screen always shows all habits.

## API Integration

### New TypeScript Types

```typescript
interface HabitConfig {
  status: string;
  enabled: boolean;
  colors?: {
    conforming: string;
    notConforming: string;
    requiredCompletionForeground: string;
    nonRequiredCompletionForeground: string;
    requiredCompletionTodayForeground: string;
  };
  display?: {
    precedingIntervals: number;
    followingDays: number;
    completionNeededTodayGlyph: string;
    completedGlyph: string;
  };
}

interface MiniGraphEntry {
  date: string;
  conformingRatio: number;
  completed: boolean;
  completionNeededToday?: boolean;  // only on today's entry
}

interface HabitSummary {
  conformingRatio: number;
  completionNeededToday: boolean;
  nextRequiredInterval: string;
  completionsInWindow: number;
  targetRepetitions: number;
  miniGraph: MiniGraphEntry[];
}

interface HabitStatusGraphEntry {
  date: string;
  assessmentStart: string;
  assessmentEnd: string;
  conformingRatioWithout: number;
  conformingRatioWith: number;
  completionCount: number;
  status: 'past' | 'present' | 'future';
  completionExpectedToday: boolean;
}

interface HabitStatus {
  status: string;
  id: string;
  title: string;
  habit: { /* config */ };
  currentState: HabitSummary;
  doneTimes: string[];
  graph: HabitStatusGraphEntry[];
}
```

### New API Client Methods

```typescript
// In services/api.ts
getHabitConfig(): Promise<HabitConfig>
getHabitStatus(id: string, preceding?: number, following?: number): Promise<HabitStatus>
```

### Backend Modification Required

Extend `habitSummary` in `/agenda` and `/get-all-todos` responses to include `miniGraph` array:

```json
{
  "habitSummary": {
    "conformingRatio": 0.8,
    "completionNeededToday": true,
    "nextRequiredInterval": "2025-01-20",
    "completionsInWindow": 4,
    "targetRepetitions": 5,
    "miniGraph": [
      { "date": "2025-01-10", "conformingRatio": 0.6, "completed": true },
      { "date": "2025-01-11", "conformingRatio": 0.7, "completed": false }
    ]
  }
}
```

**miniGraph contents:**
- Last 10-14 intervals (backend configurable or frontend specifies via query param)
- Each entry: `date`, `conformingRatio`, `completed`
- Today's entry includes `completionNeededToday`

### Caching Strategy

| Data | Cache Duration | Invalidation |
|------|----------------|--------------|
| `habitConfig` | Indefinite | App restart |
| `habitSummary/miniGraph` | Per fetch | Fresh on each agenda fetch |
| `habitStatus` (full graph) | Per habit ID | On completion |

## Files to Modify

### Frontend (mova)

| File | Changes |
|------|---------|
| `services/api.ts` | Add `getHabitConfig()`, `getHabitStatus()` methods |
| `types/` | Add habit-related TypeScript interfaces |
| `context/` | Add `HabitConfigContext` or extend existing context |
| `context/FilterContext.tsx` | Add `showHabits` filter state |
| `components/TodoItem.tsx` | Add habit graph rendering |
| `components/HabitGraph.tsx` | New - renders the consistency graph cells |
| `components/FilterModal.tsx` | Add "Show habits" toggle |
| `app/(tabs)/_layout.tsx` | Add Habits tab |
| `app/(tabs)/habits.tsx` | New - dedicated habits screen |
| `utils/filterTodos.ts` | Add habit filtering logic |
| `utils/colors.ts` | Add `lerpColor()` utility |

### Backend (org-agenda-api)

| File | Changes |
|------|---------|
| `org-agenda-api.el` | Extend `habitSummary` to include `miniGraph` array |

## Component Hierarchy

```
HabitConfigProvider (new)
└── FilterProvider (extended with showHabits)
    └── ...
        └── TodoItem
            └── HabitGraph (mini or expanded based on habitGraphMode)

HabitsScreen (new tab)
└── HabitsSummaryStats
└── HabitsList
    └── HabitRow
        └── HabitGraph (always expanded)
```

## Implementation Notes

### Synchronized Scrolling

For graph mode where all habits scroll together:
- Use a shared scroll position in context
- Each `HabitGraph` component subscribes to this position
- When any graph scrolls, update the shared position
- All other graphs sync to that position

React Native approach: Use `Animated.Value` for scroll position, share via context, bind to each `ScrollView`'s `contentOffset`.

### Graph Cell Rendering

Each cell is a small `View` with:
- Width: ~12-16px (adjustable)
- Height: ~20-24px
- Background color from `lerpColor(notConforming, conforming, ratio)`
- Optional text overlay for glyph (`☐` or `✓`)

Today's cell in full graph mode is wider (4 char equivalent): `|☐ |` or `|✓ |`

### Dark Mode

Habit colors from Emacs are fixed hex values. Options:
1. Use as-is (they're designed to be visible)
2. Apply brightness adjustment for dark mode
3. Allow user override in mova settings (future enhancement)

Start with option 1, adjust if readability issues arise.
