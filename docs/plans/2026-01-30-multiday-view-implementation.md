# Multi-day View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fixed "Week" view with a configurable "Multi-day" view that allows users to set range length and past/future day distribution.

**Architecture:** Add two new settings (`multiDayRangeLength`, `multiDayPastDays`) to the existing settings infrastructure, then update the agenda screen to use these values for date calculations and navigation.

**Tech Stack:** React Native, TypeScript, AsyncStorage, React Context

---

### Task 1: Add Settings Storage Functions

**Files:**
- Modify: `services/settings.ts:1-71`

**Step 1: Add storage key constants**

Add after line 7 (after `GROUP_BY_CATEGORY_KEY`):

```typescript
const MULTIDAY_RANGE_LENGTH_KEY = "mova_multiday_range_length";
const MULTIDAY_PAST_DAYS_KEY = "mova_multiday_past_days";
```

**Step 2: Add getter/setter for multiDayRangeLength**

Add after `setGroupByCategory` function (after line 70):

```typescript
export async function getMultiDayRangeLength(): Promise<number> {
  const value = await AsyncStorage.getItem(MULTIDAY_RANGE_LENGTH_KEY);
  return value ? parseInt(value, 10) : 7; // Default: 7 days
}

export async function setMultiDayRangeLength(days: number): Promise<void> {
  await AsyncStorage.setItem(MULTIDAY_RANGE_LENGTH_KEY, days.toString());
}
```

**Step 3: Add getter/setter for multiDayPastDays**

Add after the above:

```typescript
export async function getMultiDayPastDays(): Promise<number> {
  const value = await AsyncStorage.getItem(MULTIDAY_PAST_DAYS_KEY);
  return value ? parseInt(value, 10) : 1; // Default: 1 day of past
}

export async function setMultiDayPastDays(days: number): Promise<void> {
  await AsyncStorage.setItem(MULTIDAY_PAST_DAYS_KEY, days.toString());
}
```

**Step 4: Commit**

```bash
git add services/settings.ts
git commit -m "feat: add storage functions for multi-day view settings"
```

---

### Task 2: Add Settings to Context

**Files:**
- Modify: `context/SettingsContext.tsx:1-130`

**Step 1: Add imports**

Update the import block (lines 1-12) to include new functions:

```typescript
import {
  getDefaultDoneState,
  getGroupByCategory,
  getMultiDayPastDays,
  getMultiDayRangeLength,
  getQuickScheduleIncludeTime,
  getShowHabitsInAgenda,
  getUseClientCompletionTime,
  setDefaultDoneState as saveDefaultDoneState,
  setGroupByCategory as saveGroupByCategory,
  setMultiDayPastDays as saveMultiDayPastDays,
  setMultiDayRangeLength as saveMultiDayRangeLength,
  setQuickScheduleIncludeTime as saveQuickScheduleIncludeTime,
  setShowHabitsInAgenda as saveShowHabitsInAgenda,
  setUseClientCompletionTime as saveUseClientCompletionTime,
} from "@/services/settings";
```

**Step 2: Add to interface**

Update `SettingsContextType` interface (lines 22-34) to add after `groupByCategory`:

```typescript
interface SettingsContextType {
  quickScheduleIncludeTime: boolean;
  setQuickScheduleIncludeTime: (value: boolean) => Promise<void>;
  showHabitsInAgenda: boolean;
  setShowHabitsInAgenda: (value: boolean) => Promise<void>;
  defaultDoneState: string | null;
  setDefaultDoneState: (value: string | null) => Promise<void>;
  useClientCompletionTime: boolean;
  setUseClientCompletionTime: (value: boolean) => Promise<void>;
  groupByCategory: boolean;
  setGroupByCategory: (value: boolean) => Promise<void>;
  multiDayRangeLength: number;
  setMultiDayRangeLength: (value: number) => Promise<void>;
  multiDayPastDays: number;
  setMultiDayPastDays: (value: number) => Promise<void>;
  isLoading: boolean;
}
```

**Step 3: Add state variables**

Add after `groupByCategory` state (line 49):

```typescript
  const [multiDayRangeLength, setMultiDayRangeLengthState] = useState(7);
  const [multiDayPastDays, setMultiDayPastDaysState] = useState(1);
```

**Step 4: Update useEffect to load settings**

Update the `Promise.all` in useEffect (lines 53-75) to include new settings:

```typescript
  useEffect(() => {
    Promise.all([
      getQuickScheduleIncludeTime(),
      getShowHabitsInAgenda(),
      getDefaultDoneState(),
      getUseClientCompletionTime(),
      getGroupByCategory(),
      getMultiDayRangeLength(),
      getMultiDayPastDays(),
    ]).then(
      ([
        quickScheduleValue,
        showHabitsValue,
        defaultDoneValue,
        useClientCompletionTimeValue,
        groupByCategoryValue,
        multiDayRangeLengthValue,
        multiDayPastDaysValue,
      ]) => {
        setQuickScheduleIncludeTimeState(quickScheduleValue);
        setShowHabitsInAgendaState(showHabitsValue);
        setDefaultDoneStateState(defaultDoneValue);
        setUseClientCompletionTimeState(useClientCompletionTimeValue);
        setGroupByCategoryState(groupByCategoryValue);
        setMultiDayRangeLengthState(multiDayRangeLengthValue);
        setMultiDayPastDaysState(multiDayPastDaysValue);
        setIsLoading(false);
      },
    );
  }, []);
```

**Step 5: Add setter callbacks**

Add after `setGroupByCategory` callback (after line 100):

```typescript
  const setMultiDayRangeLength = useCallback(async (value: number) => {
    setMultiDayRangeLengthState(value);
    await saveMultiDayRangeLength(value);
    // Auto-cap pastDays if it exceeds new range
    if (multiDayPastDays >= value) {
      const cappedPastDays = Math.max(0, value - 1);
      setMultiDayPastDaysState(cappedPastDays);
      await saveMultiDayPastDays(cappedPastDays);
    }
  }, [multiDayPastDays]);

  const setMultiDayPastDays = useCallback(async (value: number) => {
    // Ensure pastDays doesn't exceed rangeLength - 1
    const cappedValue = Math.min(value, multiDayRangeLength - 1);
    setMultiDayPastDaysState(cappedValue);
    await saveMultiDayPastDays(cappedValue);
  }, [multiDayRangeLength]);
```

**Step 6: Add to Provider value**

Update the Provider value object (lines 104-116) to include new settings:

```typescript
      value={{
        quickScheduleIncludeTime,
        setQuickScheduleIncludeTime,
        showHabitsInAgenda,
        setShowHabitsInAgenda,
        defaultDoneState,
        setDefaultDoneState,
        useClientCompletionTime,
        setUseClientCompletionTime,
        groupByCategory,
        setGroupByCategory,
        multiDayRangeLength,
        setMultiDayRangeLength,
        multiDayPastDays,
        setMultiDayPastDays,
        isLoading,
      }}
```

**Step 7: Commit**

```bash
git add context/SettingsContext.tsx
git commit -m "feat: add multi-day view settings to context"
```

---

### Task 3: Add Settings UI

**Files:**
- Modify: `app/(tabs)/settings/index.tsx:26-389`

**Step 1: Destructure new settings**

Update the `useSettings()` destructure (lines 38-48) to include new settings:

```typescript
  const {
    quickScheduleIncludeTime,
    setQuickScheduleIncludeTime,
    showHabitsInAgenda,
    setShowHabitsInAgenda,
    defaultDoneState,
    setDefaultDoneState,
    useClientCompletionTime,
    setUseClientCompletionTime,
    groupByCategory,
    setGroupByCategory,
    multiDayRangeLength,
    setMultiDayRangeLength,
    multiDayPastDays,
    setMultiDayPastDays,
  } = useSettings();
```

**Step 2: Add computed future days**

Add after the `useSettings` destructure:

```typescript
  const multiDayFutureDays = multiDayRangeLength - multiDayPastDays - 1;
```

**Step 3: Add Multi-day View settings section**

Add a new section after the "Behavior" section (after line 389, before the `agendaFiles` check). Insert before `{agendaFiles && agendaFiles.files.length > 0 && (`:

```typescript
      <Divider />

      <List.Section>
        <List.Subheader>Multi-day View</List.Subheader>
        <List.Item
          title="Range Length"
          description={`${multiDayRangeLength} days total`}
          left={(props) => <List.Icon {...props} icon="calendar-range" />}
          right={() => (
            <View style={styles.stepperContainer}>
              <IconButton
                icon="minus"
                size={20}
                onPress={() =>
                  setMultiDayRangeLength(Math.max(2, multiDayRangeLength - 1))
                }
                disabled={multiDayRangeLength <= 2}
              />
              <Text style={styles.stepperValue}>{multiDayRangeLength}</Text>
              <IconButton
                icon="plus"
                size={20}
                onPress={() =>
                  setMultiDayRangeLength(Math.min(14, multiDayRangeLength + 1))
                }
                disabled={multiDayRangeLength >= 14}
              />
            </View>
          )}
        />
        <List.Item
          title="Days Before Today"
          description={`Show ${multiDayPastDays} day${multiDayPastDays !== 1 ? "s" : ""} of past`}
          left={(props) => <List.Icon {...props} icon="history" />}
          right={() => (
            <View style={styles.stepperContainer}>
              <IconButton
                icon="minus"
                size={20}
                onPress={() =>
                  setMultiDayPastDays(Math.max(0, multiDayPastDays - 1))
                }
                disabled={multiDayPastDays <= 0}
              />
              <Text style={styles.stepperValue}>{multiDayPastDays}</Text>
              <IconButton
                icon="plus"
                size={20}
                onPress={() =>
                  setMultiDayPastDays(
                    Math.min(multiDayRangeLength - 1, multiDayPastDays + 1)
                  )
                }
                disabled={multiDayPastDays >= multiDayRangeLength - 1}
              />
            </View>
          )}
        />
        <List.Item
          title="Days After Today"
          description={`${multiDayFutureDays} day${multiDayFutureDays !== 1 ? "s" : ""} (computed)`}
          left={(props) => <List.Icon {...props} icon="calendar-arrow-right" />}
        />
      </List.Section>
```

**Step 4: Add IconButton import**

Update the imports from react-native-paper (line 17-24) to include `IconButton`:

```typescript
import {
  ActivityIndicator,
  Button,
  Divider,
  IconButton,
  List,
  Menu,
  Switch,
  useTheme,
} from "react-native-paper";
```

**Step 5: Add stepper styles**

Add to the styles object (after line 466):

```typescript
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepperValue: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 16,
  },
```

**Step 6: Commit**

```bash
git add app/\(tabs\)/settings/index.tsx
git commit -m "feat: add multi-day view settings UI with steppers"
```

---

### Task 4: Update Agenda Screen - View Mode Rename

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Step 1: Update viewMode type**

Change line 145 from `"week"` to `"multiday"`:

```typescript
  const [viewMode, setViewMode] = useState<"list" | "schedule" | "multiday">(
    "list",
  );
```

**Step 2: Update getViewModeIcon**

Update the function (lines 596-600):

```typescript
  const getViewModeIcon = () => {
    if (viewMode === "list") return "view-list";
    if (viewMode === "schedule") return "clock-outline";
    return "calendar-range";
  };
```

**Step 3: Update menu item**

Update the Week menu item (lines 739-747) to Multi-day:

```typescript
              <Menu.Item
                leadingIcon="calendar-range"
                onPress={() => {
                  setViewMode("multiday");
                  setViewModeMenuVisible(false);
                }}
                title="Multi-day"
                testID="viewModeMultiday"
              />
```

**Step 4: Update all "week" references in viewMode checks**

Replace all instances of `viewMode === "week"` with `viewMode === "multiday"` throughout the file. There are approximately 6 occurrences:
- Line 557: `if (viewMode === "week")`
- Line 572: `if (viewMode === "week")`
- Line 582: `viewMode === "week" ? 7 : 1`
- Line 588: `viewMode === "week" ? 7 : 1`
- Line 614: `if (viewMode === "week")`
- Line 693: `viewMode === "week" && weekData`
- Line 779: `viewMode === "week" ?`

**Step 5: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "refactor: rename week view to multiday view"
```

---

### Task 5: Update Agenda Screen - Date Calculations

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Step 1: Import useSettings**

Add to the imports from context (around line 9):

```typescript
import { useSettings } from "@/context/SettingsContext";
```

**Step 2: Destructure multi-day settings**

Add after the existing `useSettings` destructure (around line 160):

```typescript
  const { groupByCategory, multiDayRangeLength, multiDayPastDays } = useSettings();
```

(Update the existing line that only destructures `groupByCategory`)

**Step 3: Replace getWeekStart function**

Replace the `getWeekStart` function (lines 55-63) with new functions:

```typescript
/**
 * Get the default range start date based on settings.
 * Start = today - pastDays
 */
function getDefaultRangeStart(today: Date, pastDays: number): Date {
  const result = new Date(today);
  result.setDate(result.getDate() - pastDays);
  return result;
}

/**
 * Get the range end date based on start and length.
 * End = start + rangeLength - 1
 */
function getRangeEnd(startDate: Date, rangeLength: number): Date {
  const result = new Date(startDate);
  result.setDate(result.getDate() + rangeLength - 1);
  return result;
}
```

**Step 4: Update fetchWeekAgenda to use custom range**

Update the `fetchWeekAgenda` function (lines 509-548) to use settings:

```typescript
  const fetchMultiDayAgenda = useCallback(
    async (startDate: Date, rangeLength: number, includeCompleted: boolean) => {
      if (!api) {
        return;
      }

      try {
        const startDateString = formatDateForApi(startDate);
        const endDate = getRangeEnd(startDate, rangeLength);
        const endDateString = formatDateForApi(endDate);
        const [multiDayAgendaData, statesData, habitStatusesResponse] =
          await Promise.all([
            api.getAgenda("custom", startDateString, true, includeCompleted, endDateString),
            api.getTodoStates().catch(() => null),
            api.getAllHabitStatuses(14, 14).catch(() => null),
          ]);
        setWeekData(multiDayAgendaData);
        if (statesData) {
          setTodoStates(statesData);
        }
        if (
          habitStatusesResponse?.status === "ok" &&
          habitStatusesResponse.habits
        ) {
          const statusMap = new Map<string, HabitStatus>();
          for (const status of habitStatusesResponse.habits) {
            if (status.id) {
              statusMap.set(status.id, status);
            }
          }
          setHabitStatusMap(statusMap);
        }
        setError(null);
      } catch (err) {
        console.error("Failed to load multi-day agenda:", err);
        setError("Failed to load multi-day agenda");
      }
    },
    [api],
  );
```

**Step 5: Update navigation to use rangeLength**

Update `goToPrevious` (lines 580-584):

```typescript
  const goToPrevious = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - (viewMode === "multiday" ? multiDayRangeLength : 1));
    setSelectedDate(newDate);
  }, [selectedDate, viewMode, multiDayRangeLength]);
```

Update `goToNext` (lines 586-590):

```typescript
  const goToNext = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (viewMode === "multiday" ? multiDayRangeLength : 1));
    setSelectedDate(newDate);
  }, [selectedDate, viewMode, multiDayRangeLength]);
```

**Step 6: Update goToToday to use default range**

Update `goToToday` (lines 592-594):

```typescript
  const goToToday = useCallback(() => {
    if (viewMode === "multiday") {
      setSelectedDate(getDefaultRangeStart(new Date(), multiDayPastDays));
    } else {
      setSelectedDate(new Date());
    }
  }, [viewMode, multiDayPastDays]);
```

**Step 7: Update useEffect calls to use new function**

Update the data fetching useEffect (lines 556-564):

```typescript
  useEffect(() => {
    if (viewMode === "multiday") {
      fetchMultiDayAgenda(selectedDate, multiDayRangeLength, showCompleted).finally(() =>
        setLoading(false),
      );
    } else {
      fetchAgenda(selectedDate, showCompleted).finally(() => setLoading(false));
    }
  }, [fetchAgenda, fetchMultiDayAgenda, selectedDate, showCompleted, viewMode, multiDayRangeLength]);
```

Update the mutation refetch useEffect (lines 567-578):

```typescript
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (viewMode === "multiday") {
      fetchMultiDayAgenda(selectedDate, multiDayRangeLength, showCompleted);
    } else {
      fetchAgenda(selectedDate, showCompleted);
    }
  }, [mutationVersion]);
```

Update the refresh handler (lines 612-620):

```typescript
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (viewMode === "multiday") {
      await fetchMultiDayAgenda(selectedDate, multiDayRangeLength, showCompleted);
    } else {
      await fetchAgenda(selectedDate, showCompleted);
    }
    setRefreshing(false);
  }, [fetchAgenda, fetchMultiDayAgenda, selectedDate, showCompleted, viewMode, multiDayRangeLength]);
```

**Step 8: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: implement configurable multi-day range calculations"
```

---

### Task 6: Update Date Picker Behavior

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Step 1: Update onDateChange to set start date directly**

Update the `onDateChange` callback (lines 602-610):

```typescript
  const onDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(Platform.OS === "ios");
      if (date) {
        // In multiday mode, selected date becomes the range start
        // In other modes, it's just the selected date
        setSelectedDate(date);
      }
    },
    [],
  );
```

(This is actually unchanged - the logic is already correct since we're setting `selectedDate` directly, and the fetch functions now use it as the start date)

**Step 2: Update date picker initial value for multiday mode**

The date picker already uses `selectedDate` as its value, which in multiday mode represents the range start. This is correct.

**Step 3: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: date picker selects range start in multiday mode"
```

---

### Task 7: Rename weekSections and Related Variables

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Step 1: Rename weekSections to multiDaySections**

Find and replace `weekSections` with `multiDaySections` throughout the file. Update the variable declaration (line 329) and all usages.

**Step 2: Rename weekData to multiDayData**

Find and replace `weekData` with `multiDayData` throughout the file. Update the state declaration (line 149) and all usages.

**Step 3: Rename WeekDaySection interface**

Update interface name (lines 94-100):

```typescript
interface MultiDaySectionItem {
  key: string;
  title: string;
  dateString: string;
  isToday: boolean;
  data: AgendaEntry[];
}
```

**Step 4: Update function names**

Rename `fetchWeekAgenda` to `fetchMultiDayAgenda` (already done in Task 5).

Rename `formatWeekRange` to `formatDateRange` (lines 68-80).

Rename `formatWeekDayHeader` to `formatMultiDayHeader` (lines 85-92).

**Step 5: Update testIDs**

Update `weekList` to `multiDayList` in the SectionList testID (line 788).

**Step 6: Update styles**

Rename `weekSectionHeader` to `multiDaySectionHeader` in styles (line 1004).

**Step 7: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "refactor: rename week-related variables to multiday"
```

---

### Task 8: Final Testing & Cleanup

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 2: Run the app and verify**

1. Open Settings → Multi-day View section exists
2. Adjust Range Length (should be 2-14)
3. Adjust Days Before Today (should cap at rangeLength - 1)
4. Days After Today shows computed value
5. Go to Agenda → Select Multi-day view from menu
6. Date range header shows correct range
7. Navigation buttons move by rangeLength days
8. "Go to Today" resets to (today - pastDays) as start
9. Date picker selects range start date

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete multi-day view implementation

- Configurable range length (2-14 days)
- Configurable days before today (0 to rangeLength-1)
- Days after today computed automatically
- Date picker selects range start
- Go to Today resets to configured defaults
- Renamed Week view to Multi-day throughout"
```

---

## Summary of Files Changed

| File | Changes |
|------|---------|
| `services/settings.ts` | Add storage functions for new settings |
| `context/SettingsContext.tsx` | Add settings to context with validation |
| `app/(tabs)/settings/index.tsx` | Add Multi-day View settings section with steppers |
| `app/(tabs)/index.tsx` | Rename week→multiday, implement configurable range |
