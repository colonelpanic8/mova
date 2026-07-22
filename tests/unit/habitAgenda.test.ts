/**
 * Tests for the pure org-habit agenda domain logic, with emphasis on the
 * completion-resolution fallback order:
 *
 * - isHabitCompletedOnDate / habitNeedsCompletionOnDate: status graph first
 *   (authoritative when it has an entry for the date), then the entry's own
 *   habitSummary.miniGraph, then false.
 * - collectCompletedSyntheticHabits: status graph first, then doneTimes.
 */

import type { FilterState } from "@/context/FilterContext";
import {
  AgendaEntry,
  HabitStatus,
  HabitStatusGraphEntry,
  HabitSummary,
  MiniGraphEntry,
  Todo,
} from "@/services/api";
import {
  buildHabitEntriesByDate,
  buildHabitStatusMap,
  buildMultiDaySections,
  collectCompletedSyntheticHabits,
  createSyntheticHabitEntry,
  habitNeedsCompletionOnDate,
  isEntryCompleted,
  isHabitCompletedOnDate,
  mergeHabitEntriesIntoDay,
  shouldShowEntryOnDate,
  sortEntriesForListView,
} from "@/utils/habitAgenda";

const emptyFilters: FilterState = {
  tags: { include: [], exclude: [] },
  states: [],
  priorities: [],
  dateRange: null,
  files: [],
  categories: [],
  showHabits: true,
};

function makeSummary(overrides: Partial<HabitSummary> = {}): HabitSummary {
  return {
    conformingRatio: 1,
    completionNeededToday: false,
    nextRequiredInterval: "2024-06-16",
    completionsInWindow: 0,
    targetRepetitions: 1,
    miniGraph: [],
    ...overrides,
  };
}

function makeGraphEntry(
  overrides: Partial<HabitStatusGraphEntry> = {},
): HabitStatusGraphEntry {
  return {
    date: "2024-06-15",
    assessmentStart: "2024-06-15T00:00:00",
    assessmentEnd: "2024-06-16T00:00:00",
    conformingRatioWithout: 1,
    conformingRatioWith: 1,
    completionCount: 0,
    status: "past",
    completionExpectedToday: false,
    ...overrides,
  };
}

function makeStatus(overrides: Partial<HabitStatus> = {}): HabitStatus {
  return {
    status: "ok",
    id: "habit-1",
    title: "Floss",
    habit: {
      assessmentInterval: { days: 1 },
      rescheduleInterval: { days: 1 },
      rescheduleThreshold: 1,
      maxRepetitionsPerInterval: 1,
      startTime: "2024-01-01T00:00:00",
      windowSpecs: [],
    },
    currentState: makeSummary(),
    doneTimes: [],
    graph: [],
    ...overrides,
  };
}

function makeMiniGraphEntry(
  overrides: Partial<MiniGraphEntry> = {},
): MiniGraphEntry {
  return {
    date: "2024-06-15",
    conformingRatio: 1,
    completed: false,
    ...overrides,
  };
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "habit-1",
    title: "Floss",
    todo: "TODO",
    tags: null,
    level: 1,
    scheduled: null,
    deadline: null,
    priority: null,
    file: "/test/habits.org",
    pos: 1,
    olpath: null,
    notifyBefore: null,
    category: null,
    effectiveCategory: null,
    isWindowHabit: true,
    ...overrides,
  };
}

function makeAgendaEntry(overrides: Partial<AgendaEntry> = {}): AgendaEntry {
  return {
    ...makeTodo(),
    agendaLine: "Floss",
    ...overrides,
  };
}

function statusMap(...statuses: HabitStatus[]): Map<string, HabitStatus> {
  return buildHabitStatusMap(statuses);
}

describe("buildHabitStatusMap", () => {
  it("maps statuses by id and skips statuses without an id", () => {
    const withId = makeStatus({ id: "habit-1" });
    const withoutId = makeStatus({ id: "" });
    const map = buildHabitStatusMap([withId, withoutId]);
    expect(map.size).toBe(1);
    expect(map.get("habit-1")).toBe(withId);
  });
});

describe("createSyntheticHabitEntry", () => {
  it("creates a window-habit agenda entry carrying the status's current state", () => {
    const status = makeStatus({ id: "habit-9", title: "Meditate" });
    const entry = createSyntheticHabitEntry(status, "DONE");
    expect(entry).toMatchObject({
      id: "habit-9",
      title: "Meditate",
      todo: "DONE",
      isWindowHabit: true,
      agendaLine: "Meditate",
      level: 1,
      scheduled: null,
      deadline: null,
    });
    expect(entry.habitSummary).toBe(status.currentState);
  });
});

describe("isHabitCompletedOnDate", () => {
  it("returns true when the status graph has a completion on the date", () => {
    const map = statusMap(
      makeStatus({
        graph: [makeGraphEntry({ date: "2024-06-15", completionCount: 1 })],
      }),
    );
    expect(isHabitCompletedOnDate(makeTodo(), "2024-06-15", map)).toBe(true);
  });

  it("treats a zero-completion graph entry as authoritative (no miniGraph fallback)", () => {
    const map = statusMap(
      makeStatus({
        graph: [makeGraphEntry({ date: "2024-06-15", completionCount: 0 })],
      }),
    );
    const entry = makeTodo({
      habitSummary: makeSummary({
        miniGraph: [
          makeMiniGraphEntry({ date: "2024-06-15", completed: true }),
        ],
      }),
    });
    expect(isHabitCompletedOnDate(entry, "2024-06-15", map)).toBe(false);
  });

  it("falls back to the entry's miniGraph when the graph lacks the date", () => {
    const map = statusMap(
      makeStatus({
        graph: [makeGraphEntry({ date: "2024-06-10", completionCount: 1 })],
      }),
    );
    const entry = makeTodo({
      habitSummary: makeSummary({
        miniGraph: [
          makeMiniGraphEntry({ date: "2024-06-15", completed: true }),
        ],
      }),
    });
    expect(isHabitCompletedOnDate(entry, "2024-06-15", map)).toBe(true);
  });

  it("uses the miniGraph when the entry has no id in the status map", () => {
    const entry = makeTodo({
      id: null,
      habitSummary: makeSummary({
        miniGraph: [
          makeMiniGraphEntry({ date: "2024-06-15", completed: true }),
        ],
      }),
    });
    expect(isHabitCompletedOnDate(entry, "2024-06-15", new Map())).toBe(true);
  });

  it("returns false when neither the graph nor the miniGraph covers the date", () => {
    const map = statusMap(makeStatus({ graph: [] }));
    const entry = makeTodo({ habitSummary: makeSummary({ miniGraph: [] }) });
    expect(isHabitCompletedOnDate(entry, "2024-06-15", map)).toBe(false);
  });
});

describe("habitNeedsCompletionOnDate", () => {
  it("returns the graph's completionExpectedToday when the graph has the date", () => {
    const map = statusMap(
      makeStatus({
        graph: [
          makeGraphEntry({ date: "2024-06-15", completionExpectedToday: true }),
        ],
      }),
    );
    expect(habitNeedsCompletionOnDate(makeTodo(), "2024-06-15", map)).toBe(
      true,
    );
  });

  it("treats a graph entry without the flag as authoritative false", () => {
    const graphEntry = makeGraphEntry({ date: "2024-06-15" });
    delete (graphEntry as Partial<HabitStatusGraphEntry>)
      .completionExpectedToday;
    const map = statusMap(makeStatus({ graph: [graphEntry] }));
    const entry = makeTodo({
      habitSummary: makeSummary({
        miniGraph: [
          makeMiniGraphEntry({
            date: "2024-06-15",
            completionNeededToday: true,
          }),
        ],
      }),
    });
    expect(habitNeedsCompletionOnDate(entry, "2024-06-15", map)).toBe(false);
  });

  it("falls back to the miniGraph's completionNeededToday when the graph lacks the date", () => {
    const map = statusMap(makeStatus({ graph: [] }));
    const entry = makeTodo({
      habitSummary: makeSummary({
        miniGraph: [
          makeMiniGraphEntry({
            date: "2024-06-15",
            completionNeededToday: true,
          }),
        ],
      }),
    });
    expect(habitNeedsCompletionOnDate(entry, "2024-06-15", map)).toBe(true);
  });

  it("returns false when no source covers the date", () => {
    expect(
      habitNeedsCompletionOnDate(makeTodo(), "2024-06-15", new Map()),
    ).toBe(false);
  });
});

describe("collectCompletedSyntheticHabits", () => {
  it("adds a synthetic DONE entry for a habit the graph marks completed", () => {
    const map = statusMap(
      makeStatus({
        graph: [makeGraphEntry({ date: "2024-06-15", completionCount: 1 })],
      }),
    );
    const result = collectCompletedSyntheticHabits([], map, "2024-06-15");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "habit-1", todo: "DONE" });
  });

  it("falls back to doneTimes when the graph entry shows zero completions", () => {
    const map = statusMap(
      makeStatus({
        graph: [makeGraphEntry({ date: "2024-06-15", completionCount: 0 })],
        doneTimes: ["2024-06-15T08:30:00"],
      }),
    );
    const result = collectCompletedSyntheticHabits([], map, "2024-06-15");
    expect(result).toHaveLength(1);
    expect(result[0].todo).toBe("DONE");
  });

  it("falls back to doneTimes when the graph lacks the date entirely", () => {
    const map = statusMap(
      makeStatus({ graph: [], doneTimes: ["2024-06-15T22:00:00"] }),
    );
    expect(collectCompletedSyntheticHabits([], map, "2024-06-15")).toHaveLength(
      1,
    );
  });

  it("does not add habits whose id is already present in the entries", () => {
    const map = statusMap(
      makeStatus({
        id: "habit-1",
        graph: [makeGraphEntry({ date: "2024-06-15", completionCount: 1 })],
      }),
    );
    const existing = makeAgendaEntry({ id: "habit-1" });
    expect(
      collectCompletedSyntheticHabits([existing], map, "2024-06-15"),
    ).toHaveLength(0);
  });

  it("does not add habits with no completion on the date", () => {
    const map = statusMap(
      makeStatus({
        graph: [makeGraphEntry({ date: "2024-06-15", completionCount: 0 })],
        doneTimes: ["2024-06-14T08:30:00"],
      }),
    );
    expect(collectCompletedSyntheticHabits([], map, "2024-06-15")).toHaveLength(
      0,
    );
  });
});

describe("buildHabitEntriesByDate", () => {
  it("splits graph entries into prospective TODO and completed DONE habits per date", () => {
    const map = statusMap(
      makeStatus({
        graph: [
          makeGraphEntry({ date: "2024-06-15", completionCount: 1 }),
          makeGraphEntry({
            date: "2024-06-16",
            completionExpectedToday: true,
          }),
        ],
      }),
    );
    const { prospective, completed } = buildHabitEntriesByDate(map);
    expect(completed.get("2024-06-15")).toHaveLength(1);
    expect(completed.get("2024-06-15")![0].todo).toBe("DONE");
    expect(prospective.get("2024-06-16")).toHaveLength(1);
    expect(prospective.get("2024-06-16")![0].todo).toBe("TODO");
    expect(prospective.has("2024-06-15")).toBe(false);
    expect(completed.has("2024-06-16")).toBe(false);
  });

  it("can mark the same date both prospective and completed", () => {
    const map = statusMap(
      makeStatus({
        graph: [
          makeGraphEntry({
            date: "2024-06-15",
            completionCount: 1,
            completionExpectedToday: true,
          }),
        ],
      }),
    );
    const { prospective, completed } = buildHabitEntriesByDate(map);
    expect(prospective.get("2024-06-15")).toHaveLength(1);
    expect(completed.get("2024-06-15")).toHaveLength(1);
  });
});

describe("mergeHabitEntriesIntoDay", () => {
  it("appends new prospective then completed habits after the day's entries", () => {
    const entries = [makeAgendaEntry({ id: "task-1", isWindowHabit: false })];
    const prospective = [
      createSyntheticHabitEntry(makeStatus({ id: "habit-p" }), "TODO"),
    ];
    const completed = [
      createSyntheticHabitEntry(makeStatus({ id: "habit-c" }), "DONE"),
    ];
    const merged = mergeHabitEntriesIntoDay(entries, prospective, completed);
    expect(merged.map((e) => e.id)).toEqual(["task-1", "habit-p", "habit-c"]);
  });

  it("drops habits already present in the day's entries", () => {
    const entries = [makeAgendaEntry({ id: "habit-1" })];
    const prospective = [
      createSyntheticHabitEntry(makeStatus({ id: "habit-1" }), "TODO"),
    ];
    const completed = [
      createSyntheticHabitEntry(makeStatus({ id: "habit-1" }), "DONE"),
    ];
    const merged = mergeHabitEntriesIntoDay(entries, prospective, completed);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(entries[0]);
  });

  it("does not duplicate a completed habit that is also prospective", () => {
    const prospective = [
      createSyntheticHabitEntry(makeStatus({ id: "habit-1" }), "TODO"),
    ];
    const completed = [
      createSyntheticHabitEntry(makeStatus({ id: "habit-1" }), "DONE"),
    ];
    const merged = mergeHabitEntriesIntoDay([], prospective, completed);
    expect(merged).toHaveLength(1);
    expect(merged[0].todo).toBe("TODO");
  });
});

describe("isEntryCompleted", () => {
  it("resolves habit completion per-date via the status graph", () => {
    const map = statusMap(
      makeStatus({
        graph: [makeGraphEntry({ date: "2024-06-15", completionCount: 1 })],
      }),
    );
    expect(isEntryCompleted(makeTodo(), "2024-06-15", ["DONE"], map)).toBe(
      true,
    );
    expect(isEntryCompleted(makeTodo(), "2024-06-14", ["DONE"], map)).toBe(
      false,
    );
  });

  it("uses completedAt or a done keyword for non-habits", () => {
    const base = { isWindowHabit: false };
    expect(
      isEntryCompleted(
        makeAgendaEntry({ ...base, completedAt: "2024-06-15T10:00:00" }),
        "2024-06-15",
        [],
        new Map(),
      ),
    ).toBe(true);
    expect(
      isEntryCompleted(
        makeTodo({ ...base, todo: "DONE" }),
        "2024-06-15",
        ["DONE"],
        new Map(),
      ),
    ).toBe(true);
    expect(
      isEntryCompleted(
        makeTodo({ ...base, todo: "TODO" }),
        "2024-06-15",
        ["DONE"],
        new Map(),
      ),
    ).toBe(false);
  });
});

describe("shouldShowEntryOnDate", () => {
  it("always shows non-habits", () => {
    const entry = makeTodo({ isWindowHabit: false });
    expect(
      shouldShowEntryOnDate(entry, "2024-06-15", "2024-06-15", new Map()),
    ).toBe(true);
  });

  it("always shows habits on future dates", () => {
    expect(
      shouldShowEntryOnDate(makeTodo(), "2024-06-16", "2024-06-15", new Map()),
    ).toBe(true);
  });

  it("shows habits completed on or needing completion on the selected date", () => {
    const completedMap = statusMap(
      makeStatus({
        graph: [makeGraphEntry({ date: "2024-06-15", completionCount: 1 })],
      }),
    );
    expect(
      shouldShowEntryOnDate(
        makeTodo(),
        "2024-06-15",
        "2024-06-15",
        completedMap,
      ),
    ).toBe(true);

    const neededMap = statusMap(
      makeStatus({
        graph: [
          makeGraphEntry({ date: "2024-06-15", completionExpectedToday: true }),
        ],
      }),
    );
    expect(
      shouldShowEntryOnDate(makeTodo(), "2024-06-15", "2024-06-15", neededMap),
    ).toBe(true);
  });

  it("hides habits that neither need nor have completion on the selected date", () => {
    const map = statusMap(
      makeStatus({
        graph: [makeGraphEntry({ date: "2024-06-15", completionCount: 0 })],
      }),
    );
    expect(
      shouldShowEntryOnDate(makeTodo(), "2024-06-15", "2024-06-15", map),
    ).toBe(false);
  });
});

describe("buildMultiDaySections", () => {
  const options = (
    overrides: Partial<Parameters<typeof buildMultiDaySections>[1]> = {},
  ) => ({
    filters: emptyFilters,
    showCompleted: false,
    doneStates: ["DONE"],
    habitStatusMap: new Map<string, ReturnType<typeof makeStatus>>(),
    todayString: "2024-06-15",
    ...overrides,
  });

  it("sorts days, formats titles, and marks today", () => {
    const days = {
      "2024-06-16": [makeAgendaEntry({ id: "b", isWindowHabit: false })],
      "2024-06-15": [makeAgendaEntry({ id: "a", isWindowHabit: false })],
    };
    const sections = buildMultiDaySections(days, options());
    expect(sections.map((s) => s.dateString)).toEqual([
      "2024-06-15",
      "2024-06-16",
    ]);
    expect(sections[0].isToday).toBe(true);
    expect(sections[1].isToday).toBe(false);
  });

  it("merges synthetic habit entries into their dates without duplicates", () => {
    const map = statusMap(
      makeStatus({
        id: "habit-1",
        graph: [
          makeGraphEntry({ date: "2024-06-16", completionExpectedToday: true }),
        ],
      }),
    );
    const days = {
      "2024-06-16": [makeAgendaEntry({ id: "task-1", isWindowHabit: false })],
    };
    const sections = buildMultiDaySections(
      days,
      options({ habitStatusMap: map, todayString: "2024-06-16" }),
    );
    expect(sections[0].data.map((e) => e.id)).toEqual(["task-1", "habit-1"]);
  });

  it("filters out completed items unless showCompleted, keeping today even when empty", () => {
    const done = makeAgendaEntry({
      id: "done-1",
      isWindowHabit: false,
      todo: "DONE",
    });
    const days = { "2024-06-15": [done], "2024-06-14": [done] };
    const hidden = buildMultiDaySections(days, options());
    // Yesterday's section is dropped once empty; today's stays.
    expect(hidden.map((s) => s.dateString)).toEqual(["2024-06-15"]);
    expect(hidden[0].data).toHaveLength(0);

    const shown = buildMultiDaySections(days, options({ showCompleted: true }));
    expect(shown).toHaveLength(2);
    expect(shown.every((s) => s.data.length === 1)).toBe(true);
  });
});

describe("sortEntriesForListView", () => {
  it("moves habits without a scheduled time to the bottom, preserving order otherwise", () => {
    const habitNoTime = makeAgendaEntry({ id: "habit-1", scheduled: null });
    const habitWithTime = makeAgendaEntry({
      id: "habit-2",
      scheduled: { date: "2024-06-15", time: "09:00" },
    });
    const task = makeAgendaEntry({
      id: "task-1",
      isWindowHabit: false,
      scheduled: null,
    });
    const sorted = sortEntriesForListView([habitNoTime, habitWithTime, task]);
    expect(sorted.map((e) => e.id)).toEqual(["habit-2", "task-1", "habit-1"]);
  });
});
