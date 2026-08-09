import { DateRelevance, Todo } from "../../services/api";
import {
  buildScheduledTimestamp,
  getSnappedDropTime,
  getTimeFromEntry,
  isPlanningQueueEntry,
} from "../../utils/dayPlanning";

type PlanningTodo = Todo & { dateRelevance?: DateRelevance };

const todo = (updates: Partial<PlanningTodo> = {}): PlanningTodo => ({
  id: "todo-1",
  title: "Plan the afternoon",
  todo: "TODO",
  tags: null,
  level: 1,
  scheduled: null,
  deadline: null,
  priority: null,
  file: "/test/tasks.org",
  pos: 10,
  olpath: null,
  notifyBefore: null,
  category: null,
  effectiveCategory: null,
  ...updates,
});

describe("day planning", () => {
  it("uses a deadline time when a date-only schedule has no time", () => {
    expect(
      getTimeFromEntry(
        todo({
          scheduled: { date: "2026-08-09" },
          deadline: { date: "2026-08-09", time: "16:30" },
        }),
      ),
    ).toEqual({ hours: 16, minutes: 30 });
  });

  it("snaps a visible drop to the nearest 15-minute slot", () => {
    expect(
      getSnappedDropTime({
        dropY: 183,
        viewportTop: 100,
        viewportHeight: 500,
        scrollOffset: 360,
        startHour: 0,
        endHour: 24,
        hourHeight: 60,
      }),
    ).toEqual({ hours: 7, minutes: 30 });
  });

  it("rejects a drop outside the visible timeline", () => {
    expect(
      getSnappedDropTime({
        dropY: 90,
        viewportTop: 100,
        viewportHeight: 500,
        scrollOffset: 0,
        startHour: 0,
        endHour: 24,
        hourHeight: 60,
      }),
    ).toBeNull();
  });

  it("keeps an existing schedule repeater when assigning a time", () => {
    expect(
      buildScheduledTimestamp(
        todo({
          scheduled: {
            date: "2026-08-09",
            repeater: { type: "+", value: 1, unit: "w" },
          },
        }),
        "2026-08-09",
        { hours: 9, minutes: 5 },
      ),
    ).toEqual({
      date: "2026-08-09",
      time: "09:05",
      repeater: { type: "+", value: 1, unit: "w" },
    });
  });

  it("queues date-only scheduled, overdue, and required habit entries", () => {
    expect(
      isPlanningQueueEntry(
        todo({ scheduled: { date: "2026-08-09" } }),
        "2026-08-09",
      ),
    ).toBe(true);
    expect(
      isPlanningQueueEntry(
        todo({
          scheduled: { date: "2026-08-08" },
          dateRelevance: "overdue",
        }),
        "2026-08-09",
      ),
    ).toBe(true);
    expect(
      isPlanningQueueEntry(
        todo({ isWindowHabit: true, dateRelevance: "habit_required" }),
        "2026-08-09",
      ),
    ).toBe(true);
  });

  it("keeps timed habits on the timeline instead of in the queue", () => {
    expect(
      isPlanningQueueEntry(
        todo({
          isWindowHabit: true,
          scheduled: { date: "2026-08-09", time: "07:30" },
        }),
        "2026-08-09",
      ),
    ).toBe(false);
  });
});
