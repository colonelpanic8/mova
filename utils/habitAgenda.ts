/**
 * Pure org-habit domain logic for the agenda screen.
 *
 * The agenda API response doesn't always contain habit entries for a given
 * date (e.g. a habit's scheduled date moves forward once it is completed), so
 * the agenda view reconciles the response with the habit status data
 * (`HabitStatus.graph` / `doneTimes`) and each entry's own
 * `habitSummary.miniGraph`.
 */

import { FilterState } from "@/context/FilterContext";
import { AgendaEntry, HabitStatus, MiniGraphEntry, Todo } from "@/services/api";
import { formatMultiDayHeader } from "@/utils/dateFormatting";
import { filterTodos } from "@/utils/filterTodos";
import { isHabitTodo } from "@/utils/habits";

/**
 * Create a synthetic AgendaEntry for a habit that isn't in the API agenda
 * response (e.g. because its scheduled date moved forward after completion).
 */
export function createSyntheticHabitEntry(
  status: HabitStatus,
  todo: string,
): AgendaEntry {
  return {
    id: status.id,
    title: status.title,
    isWindowHabit: true,
    agendaLine: status.title,
    file: null,
    pos: null,
    level: 1,
    todo,
    tags: null,
    scheduled: null,
    deadline: null,
    priority: null,
    olpath: null,
    notifyBefore: null,
    category: null,
    effectiveCategory: null,
    habitSummary: status.currentState,
  };
}

/** Build a map of habit id -> status for quick lookup. */
export function buildHabitStatusMap(
  statuses: HabitStatus[],
): Map<string, HabitStatus> {
  const statusMap = new Map<string, HabitStatus>();
  for (const status of statuses) {
    if (status.id) {
      statusMap.set(status.id, status);
    }
  }
  return statusMap;
}

/**
 * Check if a habit was completed on a specific date.
 *
 * Resolution order: the habit status graph (authoritative when it has an
 * entry for the date, even if that entry reports zero completions), then the
 * entry's own `habitSummary.miniGraph`, then false.
 */
export function isHabitCompletedOnDate(
  entry: Todo,
  dateString: string,
  habitStatusMap: Map<string, HabitStatus>,
): boolean {
  // First check the habit status map for the graph data
  if (entry.id) {
    const habitStatus = habitStatusMap.get(entry.id);
    if (habitStatus?.graph?.length) {
      const dateEntry = habitStatus.graph.find((e) => e.date === dateString);
      if (dateEntry) {
        return dateEntry.completionCount > 0;
      }
    }
  }
  // Fall back to entry's miniGraph if available
  const miniGraph = entry.habitSummary?.miniGraph;
  if (miniGraph?.length) {
    const dateEntry = miniGraph.find(
      (e: MiniGraphEntry) => e.date === dateString,
    );
    if (dateEntry) {
      return dateEntry.completed;
    }
  }
  return false;
}

/**
 * Check if a habit needs completion on a specific date.
 *
 * Same resolution order as {@link isHabitCompletedOnDate}: status graph
 * first, then the entry's miniGraph, then false.
 */
export function habitNeedsCompletionOnDate(
  entry: Todo,
  dateString: string,
  habitStatusMap: Map<string, HabitStatus>,
): boolean {
  // First check the habit status map for graph data
  if (entry.id) {
    const habitStatus = habitStatusMap.get(entry.id);
    if (habitStatus?.graph?.length) {
      const dateEntry = habitStatus.graph.find((e) => e.date === dateString);
      if (dateEntry) {
        return dateEntry.completionExpectedToday ?? false;
      }
    }
  }
  // Fall back to entry's miniGraph if available
  const miniGraph = entry.habitSummary?.miniGraph;
  if (miniGraph?.length) {
    const dateEntry = miniGraph.find(
      (e: MiniGraphEntry) => e.date === dateString,
    );
    if (dateEntry) {
      return dateEntry.completionNeededToday ?? false;
    }
  }
  return false;
}

/**
 * Synthetic DONE entries for habits completed on `dateString` that aren't
 * already present in `entries` (because their scheduled date moved forward
 * after completion).
 *
 * Completion is resolved from the status graph first, then falls back to the
 * `doneTimes` ISO timestamps (which handles dates the graph omits after a
 * habit was rescheduled).
 */
export function collectCompletedSyntheticHabits(
  entries: AgendaEntry[],
  habitStatusMap: Map<string, HabitStatus>,
  dateString: string,
): AgendaEntry[] {
  const existingIds = new Set(entries.filter((e) => e.id).map((e) => e.id));

  const completedHabitsToAdd: AgendaEntry[] = [];
  habitStatusMap.forEach((status) => {
    // Skip if already in the entries
    if (existingIds.has(status.id)) return;

    // Check if this habit was completed on the selected date
    // First try the graph data
    const graphEntry = status.graph?.find((e) => e.date === dateString);
    let wasCompletedOnDate = graphEntry && graphEntry.completionCount > 0;

    // Also check doneTimes array for completions on this date
    // (handles case where graph doesn't include entry for dates after habit was rescheduled)
    if (!wasCompletedOnDate && status.doneTimes?.length) {
      wasCompletedOnDate = status.doneTimes.some((doneTime) => {
        // doneTimes are ISO timestamps - extract date portion
        const doneDate = doneTime.split("T")[0];
        return doneDate === dateString;
      });
    }

    if (wasCompletedOnDate) {
      completedHabitsToAdd.push(createSyntheticHabitEntry(status, "DONE"));
    }
  });

  return completedHabitsToAdd;
}

/**
 * Per-date synthetic habit entries derived from the habit status graphs, for
 * the multi-day view: prospective (completion expected on that date, as TODO
 * entries) and completed (completions recorded on that date, as DONE entries).
 */
export interface HabitEntriesByDate {
  prospective: Map<string, AgendaEntry[]>;
  completed: Map<string, AgendaEntry[]>;
}

/** Build maps of date -> habits for prospective and completed habits. */
export function buildHabitEntriesByDate(
  habitStatusMap: Map<string, HabitStatus>,
): HabitEntriesByDate {
  const prospective = new Map<string, AgendaEntry[]>();
  const completed = new Map<string, AgendaEntry[]>();

  habitStatusMap.forEach((status) => {
    status.graph?.forEach((graphEntry) => {
      const dateStr = graphEntry.date;

      // Track prospective habits (need completion on this date)
      if (graphEntry.completionExpectedToday) {
        if (!prospective.has(dateStr)) {
          prospective.set(dateStr, []);
        }
        prospective
          .get(dateStr)!
          .push(createSyntheticHabitEntry(status, "TODO"));
      }

      // Track completed habits (completed on this date)
      if (graphEntry.completionCount > 0) {
        if (!completed.has(dateStr)) {
          completed.set(dateStr, []);
        }
        completed.get(dateStr)!.push(createSyntheticHabitEntry(status, "DONE"));
      }
    });
  });

  return { prospective, completed };
}

/**
 * Merge synthetic habit entries into a day's entries, avoiding duplicates:
 * prospective habits already present in `entries` are dropped, and completed
 * habits already present in `entries` or the surviving prospective set are
 * dropped. Order: entries, then new prospective habits, then new completed
 * habits.
 */
export function mergeHabitEntriesIntoDay(
  entries: AgendaEntry[],
  prospectiveHabits: AgendaEntry[],
  completedHabits: AgendaEntry[],
): AgendaEntry[] {
  const existingIds = new Set(entries.filter((e) => e.id).map((e) => e.id));
  const newProspectiveHabits = prospectiveHabits.filter(
    (h) => !existingIds.has(h.id),
  );
  // Add prospective habits to the set to avoid duplicating with completed
  newProspectiveHabits.forEach((h) => existingIds.add(h.id));
  const newCompletedHabits = completedHabits.filter(
    (h) => !existingIds.has(h.id),
  );
  return [...entries, ...newProspectiveHabits, ...newCompletedHabits];
}

/**
 * Whether an agenda entry counts as completed on the selected date: habits
 * use per-date completion resolution ({@link isHabitCompletedOnDate});
 * everything else uses `completedAt` or a done TODO keyword.
 */
export function isEntryCompleted(
  entry: Todo & { completedAt?: string | null },
  selectedDateString: string,
  doneStates: string[],
  habitStatusMap: Map<string, HabitStatus>,
): boolean {
  if (isHabitTodo(entry)) {
    // Check completion for the selected date, not just today
    return isHabitCompletedOnDate(entry, selectedDateString, habitStatusMap);
  }
  return Boolean(entry.completedAt || doneStates.includes(entry.todo));
}

/**
 * Whether an entry should appear in the agenda for the selected date: habits
 * that neither need completion nor were completed on that date are filtered
 * out. Non-habits always show.
 *
 * Note: For future dates, habits returned by the API are scheduled for that
 * date, so show them.
 */
export function shouldShowEntryOnDate(
  entry: Todo,
  selectedDateString: string,
  todayString: string,
  habitStatusMap: Map<string, HabitStatus>,
): boolean {
  if (isHabitTodo(entry)) {
    // For future dates, show habits that are in the API response
    // (they're returned because they're scheduled/deadline for that date)
    if (selectedDateString > todayString) {
      return true;
    }

    const completedOnSelectedDate = isHabitCompletedOnDate(
      entry,
      selectedDateString,
      habitStatusMap,
    );
    const needsCompletionOnSelectedDate = habitNeedsCompletionOnDate(
      entry,
      selectedDateString,
      habitStatusMap,
    );
    // Show if: needs completion on selected date OR was completed on selected date
    return completedOnSelectedDate || needsCompletionOnSelectedDate;
  }
  return true; // Non-habits always show
}

/** One day's section in the multi-day agenda view. */
export interface MultiDaySectionItem {
  key: string;
  title: string;
  dateString: string;
  isToday: boolean;
  data: AgendaEntry[];
}

/**
 * Build the multi-day view's sections from the raw per-day API entries:
 * apply the user's filters, merge in synthetic habit entries per date, hide
 * completed items unless `showCompleted`, and drop empty days (except today).
 */
export function buildMultiDaySections(
  days: Record<string, AgendaEntry[]>,
  options: {
    filters: FilterState;
    showCompleted: boolean;
    doneStates: string[];
    habitStatusMap: Map<string, HabitStatus>;
    todayString: string;
  },
): MultiDaySectionItem[] {
  const { filters, showCompleted, doneStates, habitStatusMap, todayString } =
    options;

  // Maps of date -> prospective/completed habits from the status graphs
  const habitEntriesByDate = buildHabitEntriesByDate(habitStatusMap);

  return Object.entries(days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateString, entries]) => {
      const filtered = filterTodos(entries, filters);

      // Merge habits with existing entries, avoiding duplicates
      const mergedEntries = mergeHabitEntriesIntoDay(
        filtered,
        habitEntriesByDate.prospective.get(dateString) || [],
        habitEntriesByDate.completed.get(dateString) || [],
      );

      const displayEntries = showCompleted
        ? mergedEntries
        : mergedEntries.filter((e) => {
            if (isHabitTodo(e)) {
              // For habits, check completion using miniGraph/habitStatusMap
              return !isHabitCompletedOnDate(e, dateString, habitStatusMap);
            }
            return !e.completedAt && !doneStates.includes(e.todo);
          });

      return {
        key: dateString,
        title: formatMultiDayHeader(dateString),
        dateString,
        isToday: dateString === todayString,
        data: displayEntries,
      };
    })
    .filter((section) => section.data.length > 0 || section.isToday);
}

/**
 * Sort entries for list view: habits without a scheduled time go to the bottom,
 * grouped together. Regular tasks and habits with scheduled times stay at the top
 * in their original order.
 */
export function sortEntriesForListView<T extends Todo>(entries: T[]): T[] {
  const regularItems: T[] = [];
  const habitsWithoutTime: T[] = [];

  for (const entry of entries) {
    const isHabit = isHabitTodo(entry);
    const hasScheduledTime = entry.scheduled?.time != null;

    if (isHabit && !hasScheduledTime) {
      habitsWithoutTime.push(entry);
    } else {
      regularItems.push(entry);
    }
  }

  return [...regularItems, ...habitsWithoutTime];
}
