# Habits Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add org-window-habit support to mova frontend with inline graphs, a dedicated habits screen, and filter toggle.

**Architecture:** Extend existing Todo/AgendaEntry types with habit fields. Create HabitGraph component for rendering consistency graphs. Add HabitConfigContext for colors. Extend FilterContext for habit visibility toggle. Add new Habits tab.

**Tech Stack:** React Native, Expo Router, React Native Paper, TypeScript

---

## Task 1: Add Habit TypeScript Types

**Files:**

- Modify: `services/api.ts`

**Step 1: Add habit-related interfaces**

Add after line 33 (after `AgendaEntry` interface):

```typescript
// Habit types
export interface MiniGraphEntry {
  date: string;
  conformingRatio: number;
  completed: boolean;
  completionNeededToday?: boolean;
}

export interface HabitSummary {
  conformingRatio: number;
  completionNeededToday: boolean;
  nextRequiredInterval: string;
  completionsInWindow: number;
  targetRepetitions: number;
  miniGraph: MiniGraphEntry[];
}

export interface HabitConfig {
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

export interface HabitStatusGraphEntry {
  date: string;
  assessmentStart: string;
  assessmentEnd: string;
  conformingRatioWithout: number;
  conformingRatioWith: number;
  completionCount: number;
  status: "past" | "present" | "future";
  completionExpectedToday: boolean;
}

export interface HabitStatus {
  status: string;
  id: string;
  title: string;
  habit: {
    assessmentInterval: Record<string, number>;
    rescheduleInterval: Record<string, number>;
    rescheduleThreshold: number;
    maxRepetitionsPerInterval: number;
    startTime: string;
    windowSpecs: Array<{
      duration: Record<string, number>;
      targetRepetitions: number;
      conformingValue: number;
    }>;
  };
  currentState: HabitSummary;
  doneTimes: string[];
  graph: HabitStatusGraphEntry[];
}
```

**Step 2: Extend Todo interface**

Modify the `Todo` interface to add optional habit fields after line 28 (after `body`):

```typescript
  // Habit fields (present when isWindowHabit is true)
  isWindowHabit?: boolean;
  habitSummary?: HabitSummary;
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors related to new types

**Step 4: Commit**

```bash
git add services/api.ts
git commit -m "feat: add habit TypeScript types"
```

---

## Task 2: Add Habit API Methods

**Files:**

- Modify: `services/api.ts`
- Create: `tests/unit/habitApi.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/habitApi.test.ts`:

```typescript
import { api } from "@/services/api";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("Habit API methods", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    api.configure("http://localhost:8080", "user", "pass");
  });

  describe("getHabitConfig", () => {
    it("fetches habit configuration", async () => {
      const mockResponse = {
        status: "ok",
        enabled: true,
        colors: {
          conforming: "#4d7085",
          notConforming: "#d40d0d",
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await api.getHabitConfig();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/habit-config",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.any(String),
          }),
        }),
      );
      expect(result.enabled).toBe(true);
      expect(result.colors?.conforming).toBe("#4d7085");
    });
  });

  describe("getHabitStatus", () => {
    it("fetches habit status with id", async () => {
      const mockResponse = {
        status: "ok",
        id: "habit-123",
        title: "Exercise",
        graph: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await api.getHabitStatus("habit-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/habit-status?id=habit-123",
        expect.any(Object),
      );
      expect(result.id).toBe("habit-123");
    });

    it("includes optional preceding and following params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ status: "ok" })),
      });

      await api.getHabitStatus("habit-123", 10, 5);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/habit-status?id=habit-123&preceding=10&following=5",
        expect.any(Object),
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx jest tests/unit/habitApi.test.ts -v`

Expected: FAIL with "api.getHabitConfig is not a function"

**Step 3: Add API methods**

Add to `services/api.ts` before the closing brace of `OrgAgendaApi` class (around line 392):

```typescript
  async getHabitConfig(): Promise<HabitConfig> {
    return this.request<HabitConfig>("/habit-config");
  }

  async getHabitStatus(
    id: string,
    preceding?: number,
    following?: number
  ): Promise<HabitStatus> {
    const params = new URLSearchParams({ id });
    if (preceding !== undefined) {
      params.append("preceding", preceding.toString());
    }
    if (following !== undefined) {
      params.append("following", following.toString());
    }
    return this.request<HabitStatus>(`/habit-status?${params.toString()}`);
  }
```

**Step 4: Run test to verify it passes**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx jest tests/unit/habitApi.test.ts -v`

Expected: PASS

**Step 5: Commit**

```bash
git add services/api.ts tests/unit/habitApi.test.ts
git commit -m "feat: add getHabitConfig and getHabitStatus API methods"
```

---

## Task 3: Add Color Utility Functions

**Files:**

- Create: `utils/habitColors.ts`
- Create: `tests/unit/habitColors.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/habitColors.test.ts`:

```typescript
import { lerpColor, getHabitCellColor } from "@/utils/habitColors";

describe("habitColors", () => {
  describe("lerpColor", () => {
    it("returns first color when ratio is 0", () => {
      const result = lerpColor("#ff0000", "#00ff00", 0);
      expect(result).toBe("#ff0000");
    });

    it("returns second color when ratio is 1", () => {
      const result = lerpColor("#ff0000", "#00ff00", 1);
      expect(result).toBe("#00ff00");
    });

    it("returns midpoint color when ratio is 0.5", () => {
      const result = lerpColor("#000000", "#ffffff", 0.5);
      // Should be around #808080 (gray)
      expect(result.toLowerCase()).toBe("#808080");
    });

    it("handles lowercase hex colors", () => {
      const result = lerpColor("#aabbcc", "#ddeeff", 0);
      expect(result.toLowerCase()).toBe("#aabbcc");
    });
  });

  describe("getHabitCellColor", () => {
    const defaultColors = {
      conforming: "#4d7085",
      notConforming: "#d40d0d",
    };

    it("returns not-conforming color for ratio 0", () => {
      const result = getHabitCellColor(0, defaultColors);
      expect(result).toBe("#d40d0d");
    });

    it("returns conforming color for ratio 1", () => {
      const result = getHabitCellColor(1, defaultColors);
      expect(result).toBe("#4d7085");
    });

    it("clamps ratio above 1 to 1", () => {
      const result = getHabitCellColor(1.5, defaultColors);
      expect(result).toBe("#4d7085");
    });

    it("clamps ratio below 0 to 0", () => {
      const result = getHabitCellColor(-0.5, defaultColors);
      expect(result).toBe("#d40d0d");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx jest tests/unit/habitColors.test.ts -v`

Expected: FAIL with "Cannot find module '@/utils/habitColors'"

**Step 3: Implement the utility**

Create `utils/habitColors.ts`:

```typescript
/**
 * Linearly interpolate between two hex colors.
 * @param color1 Starting hex color (e.g., "#ff0000")
 * @param color2 Ending hex color (e.g., "#00ff00")
 * @param ratio Value between 0 and 1 (0 = color1, 1 = color2)
 * @returns Interpolated hex color
 */
export function lerpColor(
  color1: string,
  color2: string,
  ratio: number,
): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export interface HabitColors {
  conforming: string;
  notConforming: string;
}

export const DEFAULT_HABIT_COLORS: HabitColors = {
  conforming: "#4d7085",
  notConforming: "#d40d0d",
};

/**
 * Get the background color for a habit graph cell based on conforming ratio.
 * @param conformingRatio Value between 0 and 1
 * @param colors Habit color configuration
 * @returns Hex color string
 */
export function getHabitCellColor(
  conformingRatio: number,
  colors: HabitColors = DEFAULT_HABIT_COLORS,
): string {
  const clampedRatio = Math.max(0, Math.min(1, conformingRatio));
  return lerpColor(colors.notConforming, colors.conforming, clampedRatio);
}
```

**Step 4: Run test to verify it passes**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx jest tests/unit/habitColors.test.ts -v`

Expected: PASS

**Step 5: Commit**

```bash
git add utils/habitColors.ts tests/unit/habitColors.test.ts
git commit -m "feat: add color interpolation utilities for habit graphs"
```

---

## Task 4: Create HabitConfigContext

**Files:**

- Create: `context/HabitConfigContext.tsx`
- Modify: `app/_layout.tsx`

**Step 1: Create the context**

Create `context/HabitConfigContext.tsx`:

```typescript
import { api, HabitConfig } from "@/services/api";
import { DEFAULT_HABIT_COLORS, HabitColors } from "@/utils/habitColors";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface HabitConfigContextType {
  config: HabitConfig | null;
  isLoading: boolean;
  error: string | null;
  colors: HabitColors;
  glyphs: {
    completionNeededToday: string;
    completed: string;
  };
  refetch: () => Promise<void>;
}

const DEFAULT_GLYPHS = {
  completionNeededToday: "\u2610", // ☐
  completed: "\u2713", // ✓
};

const HabitConfigContext = createContext<HabitConfigContextType | undefined>(
  undefined
);

export function HabitConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HabitConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.getHabitConfig();
      setConfig(result);
    } catch (err) {
      console.error("Failed to fetch habit config:", err);
      setError("Failed to load habit configuration");
      // Set default config so app still works
      setConfig({ status: "ok", enabled: false });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const colors: HabitColors = config?.colors
    ? {
        conforming: config.colors.conforming,
        notConforming: config.colors.notConforming,
      }
    : DEFAULT_HABIT_COLORS;

  const glyphs = config?.display
    ? {
        completionNeededToday: config.display.completionNeededTodayGlyph,
        completed: config.display.completedGlyph,
      }
    : DEFAULT_GLYPHS;

  return (
    <HabitConfigContext.Provider
      value={{
        config,
        isLoading,
        error,
        colors,
        glyphs,
        refetch: fetchConfig,
      }}
    >
      {children}
    </HabitConfigContext.Provider>
  );
}

export function useHabitConfig(): HabitConfigContextType {
  const context = useContext(HabitConfigContext);
  if (context === undefined) {
    throw new Error("useHabitConfig must be used within a HabitConfigProvider");
  }
  return context;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors

**Step 3: Add provider to app layout**

Modify `app/_layout.tsx`. Find the provider chain (around line 50-80) and add `HabitConfigProvider` inside the `AuthProvider`:

First, add the import at the top:

```typescript
import { HabitConfigProvider } from "@/context/HabitConfigContext";
```

Then wrap children with the provider. Find where `TemplatesProvider` wraps children and add `HabitConfigProvider` after it:

```typescript
<HabitConfigProvider>
  {children}
</HabitConfigProvider>
```

**Step 4: Verify app still loads**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx tsc --noEmit`

Expected: No errors

**Step 5: Commit**

```bash
git add context/HabitConfigContext.tsx app/_layout.tsx
git commit -m "feat: add HabitConfigContext for habit colors and settings"
```

---

## Task 5: Add showHabits Filter

**Files:**

- Modify: `context/FilterContext.tsx`
- Modify: `utils/filterTodos.ts`

**Step 1: Add showHabits to FilterState**

Modify `context/FilterContext.tsx`. Add to `FilterState` interface (around line 25):

```typescript
showHabits: boolean;
```

Update `initialFilterState` (around line 60):

```typescript
const initialFilterState: FilterState = {
  tags: { include: [], exclude: [] },
  states: [],
  priorities: [],
  dateRange: null,
  files: [],
  categories: [],
  showHabits: true, // Default to showing habits
};
```

Add to `FilterContextType` interface (around line 41):

```typescript
  showHabits: boolean;
  setShowHabits: (show: boolean) => void;
```

Add the setter function in `FilterProvider` (after line 158):

```typescript
const setShowHabits = useCallback((show: boolean) => {
  setFilters((prev) => ({ ...prev, showHabits: show }));
}, []);
```

Add to the Provider value:

```typescript
showHabits: filters.showHabits,
setShowHabits,
```

**Step 2: Update filterTodos utility**

Read `utils/filterTodos.ts` first, then add habit filtering. Add this check at the beginning of the filter logic (after the function signature):

```typescript
// Filter out habits if showHabits is false
if (!filters.showHabits && todo.isWindowHabit) {
  return false;
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add context/FilterContext.tsx utils/filterTodos.ts
git commit -m "feat: add showHabits filter to hide/show habits in agenda"
```

---

## Task 6: Add Habits Toggle to FilterModal

**Files:**

- Modify: `components/FilterModal.tsx`

**Step 1: Add toggle UI**

Import Switch from react-native-paper (add to existing imports):

```typescript
import {
  // ... existing imports
  Switch,
} from "react-native-paper";
```

Get showHabits from useFilters (add to destructuring around line 93):

```typescript
const {
  filters,
  // ... existing
  showHabits,
  setShowHabits,
} = useFilters();
```

Add a new section for Habits at the beginning of the ScrollView content (before Tags Section, around line 211):

```typescript
{/* Habits Toggle */}
<View style={styles.toggleSection}>
  <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
    Show Habits
  </Text>
  <Switch
    value={filters.showHabits}
    onValueChange={setShowHabits}
    testID="filterShowHabits"
  />
</View>
<Divider style={{ marginBottom: 16 }} />
```

Add the style for toggleSection:

```typescript
toggleSection: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
},
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add components/FilterModal.tsx
git commit -m "feat: add habits toggle to filter modal"
```

---

## Task 7: Create HabitGraph Component

**Files:**

- Create: `components/HabitGraph.tsx`

**Step 1: Create the component**

Create `components/HabitGraph.tsx`:

```typescript
import { useHabitConfig } from "@/context/HabitConfigContext";
import { MiniGraphEntry } from "@/services/api";
import { getHabitCellColor } from "@/utils/habitColors";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface HabitGraphProps {
  miniGraph: MiniGraphEntry[];
  expanded?: boolean;
}

interface GraphCellProps {
  entry: MiniGraphEntry;
  isToday: boolean;
  colors: { conforming: string; notConforming: string };
  glyphs: { completionNeededToday: string; completed: string };
}

function GraphCell({ entry, isToday, colors, glyphs }: GraphCellProps) {
  const backgroundColor = getHabitCellColor(entry.conformingRatio, colors);

  let glyph = "";
  if (isToday || entry.completionNeededToday) {
    if (entry.completed) {
      glyph = glyphs.completed;
    } else if (entry.completionNeededToday) {
      glyph = glyphs.completionNeededToday;
    }
  } else if (entry.completed) {
    glyph = glyphs.completed;
  }

  return (
    <View
      style={[
        styles.cell,
        { backgroundColor },
        isToday && styles.todayCell,
      ]}
    >
      {glyph ? (
        <Text style={styles.glyph}>{glyph}</Text>
      ) : null}
    </View>
  );
}

export function HabitGraph({ miniGraph, expanded = false }: HabitGraphProps) {
  const { colors, glyphs } = useHabitConfig();

  if (!miniGraph || miniGraph.length === 0) {
    return null;
  }

  // Find today's index (last entry with completionNeededToday defined, or second-to-last)
  const todayIndex = miniGraph.findIndex((e) => e.completionNeededToday !== undefined);
  const effectiveTodayIndex = todayIndex >= 0 ? todayIndex : miniGraph.length - 2;

  return (
    <View style={[styles.container, expanded && styles.expandedContainer]}>
      {miniGraph.map((entry, index) => (
        <GraphCell
          key={entry.date}
          entry={entry}
          isToday={index === effectiveTodayIndex}
          colors={colors}
          glyphs={glyphs}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  expandedContainer: {
    // For expanded mode - will be scrollable
  },
  cell: {
    width: 12,
    height: 16,
    marginHorizontal: 1,
    borderRadius: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  todayCell: {
    width: 16,
    borderWidth: 1,
    borderColor: "#000",
  },
  glyph: {
    fontSize: 10,
    color: "#000",
  },
});

export default HabitGraph;
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add components/HabitGraph.tsx
git commit -m "feat: add HabitGraph component for rendering habit consistency graphs"
```

---

## Task 8: Add HabitGraph to TodoItem

**Files:**

- Modify: `components/TodoItem.tsx`

**Step 1: Import HabitGraph**

Add import at top of file:

```typescript
import { HabitGraph } from "@/components/HabitGraph";
```

**Step 2: Add habit graph rendering**

In the `TodoItem` component, after the `metaRow` View (around line 335, before the closing `</View>` of `todoItem`), add:

```typescript
{/* Habit Graph */}
{todo.isWindowHabit && todo.habitSummary?.miniGraph && (
  <HabitGraph miniGraph={todo.habitSummary.miniGraph} />
)}
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add components/TodoItem.tsx
git commit -m "feat: display habit graph in TodoItem for window-habits"
```

---

## Task 9: Create Habits Screen

**Files:**

- Create: `app/(tabs)/habits.tsx`

**Step 1: Create the screen**

Create `app/(tabs)/habits.tsx`:

```typescript
import { HabitGraph } from "@/components/HabitGraph";
import { TodoItem } from "@/components/TodoItem";
import { useAuth } from "@/context/AuthContext";
import { useHabitConfig } from "@/context/HabitConfigContext";
import { useMutation } from "@/context/MutationContext";
import { api, Todo } from "@/services/api";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";

interface HabitStats {
  remainingToday: number;
  totalHabits: number;
  onTrack: number;
}

function HabitStatsCard({ stats }: { stats: HabitStats }) {
  const theme = useTheme();

  return (
    <Card style={styles.statsCard}>
      <Card.Content style={styles.statsContent}>
        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
            {stats.remainingToday}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            remaining today
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={{ color: theme.colors.tertiary }}>
            {stats.onTrack}/{stats.totalHabits}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            on track
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

export default function HabitsScreen() {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const { config } = useHabitConfig();
  const { mutationVersion } = useMutation();
  const [habits, setHabits] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHabits = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getAllTodos();
      const habitTodos = response.todos.filter((todo) => todo.isWindowHabit);
      setHabits(habitTodos);
    } catch (err) {
      console.error("Failed to load habits:", err);
      setError("Failed to load habits");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadHabits();
  }, [loadHabits, mutationVersion]);

  const stats = useMemo((): HabitStats => {
    const remainingToday = habits.filter(
      (h) => h.habitSummary?.completionNeededToday && h.todo !== "DONE"
    ).length;
    const onTrack = habits.filter(
      (h) => (h.habitSummary?.conformingRatio ?? 0) >= 1.0
    ).length;
    return {
      remainingToday,
      totalHabits: habits.length,
      onTrack,
    };
  }, [habits]);

  const renderItem = useCallback(
    ({ item }: { item: Todo }) => <TodoItem todo={item} />,
    []
  );

  const keyExtractor = useCallback(
    (item: Todo) => item.id || `${item.file}:${item.pos}`,
    []
  );

  if (!config?.enabled) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            Habits are not enabled on your server.
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Enable org-window-habit-mode in Emacs to use this feature.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={habits}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={<HabitStatsCard stats={stats} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                No habits found
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadHabits} />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  statsCard: {
    margin: 16,
  },
  statsContent: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#ccc",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add app/\(tabs\)/habits.tsx
git commit -m "feat: add dedicated Habits screen with stats"
```

---

## Task 10: Add Habits Tab to Navigation

**Files:**

- Modify: `app/(tabs)/_layout.tsx`

**Step 1: Add Habits tab**

Add a new `Tabs.Screen` for habits after the "views" tab (around line 161):

```typescript
<Tabs.Screen
  name="habits"
  options={{
    title: "Habits",
    tabBarButtonTestID: "tabHabits",
    tabBarIcon: ({ color, size }) => (
      <MaterialCommunityIcons
        name="chart-timeline-variant"
        size={size}
        color={color}
      />
    ),
  }}
/>
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add app/\(tabs\)/_layout.tsx
git commit -m "feat: add Habits tab to navigation"
```

---

## Task 11: Run Full Test Suite

**Step 1: Run all tests**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npm test`

Expected: All tests pass

**Step 2: Fix any failures**

If tests fail, investigate and fix.

**Step 3: Run TypeScript check**

Run: `cd /home/imalison/Projects/mova/.worktrees/habits-frontend && npx tsc --noEmit`

Expected: No errors

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address test failures from habits integration"
```

---

## Summary

| Task | Description                       | Files                                                    |
| ---- | --------------------------------- | -------------------------------------------------------- |
| 1    | Add habit TypeScript types        | `services/api.ts`                                        |
| 2    | Add habit API methods             | `services/api.ts`, `tests/unit/habitApi.test.ts`         |
| 3    | Add color utilities               | `utils/habitColors.ts`, `tests/unit/habitColors.test.ts` |
| 4    | Create HabitConfigContext         | `context/HabitConfigContext.tsx`, `app/_layout.tsx`      |
| 5    | Add showHabits filter             | `context/FilterContext.tsx`, `utils/filterTodos.ts`      |
| 6    | Add habits toggle to filter modal | `components/FilterModal.tsx`                             |
| 7    | Create HabitGraph component       | `components/HabitGraph.tsx`                              |
| 8    | Add HabitGraph to TodoItem        | `components/TodoItem.tsx`                                |
| 9    | Create Habits screen              | `app/(tabs)/habits.tsx`                                  |
| 10   | Add Habits tab                    | `app/(tabs)/_layout.tsx`                                 |
| 11   | Run full test suite               | -                                                        |

---

## Future Enhancements (Not in this plan)

- Graph mode with synchronized horizontal scrolling
- Full graph data fetching via `/habit-status` for expanded mode
- Persist showHabits preference to AsyncStorage
