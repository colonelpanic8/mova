import { DateRelevance, Todo } from "../../services/api";
import {
  buildDailyPlanValue,
  buildScheduledTimestamp,
  DAILY_PLAN_PROPERTY,
  getDailyPlanTime,
  getPlannerTime,
  getSnappedDropTime,
  getTimeFromEntry,
  isPlanningQueueEntry,
  scheduleTimeToMinutes,
  shiftScheduleTime,
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

  it("uses a matching date-specific plan without changing the habit schedule", () => {
    const habit = todo({
      properties: {
        STYLE: "habit",
        [DAILY_PLAN_PROPERTY]: "2026-08-09T14:45",
      },
      scheduled: { date: "2026-05-24", time: "08:00" },
    });

    expect(getDailyPlanTime(habit, "2026-08-09")).toEqual({
      hours: 14,
      minutes: 45,
    });
    expect(getPlannerTime(habit, "2026-08-09")).toEqual({
      hours: 14,
      minutes: 45,
    });
    expect(habit.scheduled).toEqual({ date: "2026-05-24", time: "08:00" });
    expect(isPlanningQueueEntry(habit, "2026-08-09")).toBe(false);
  });

  it("ignores a daily plan from another date", () => {
    const habit = todo({
      properties: {
        STYLE: "habit",
        [DAILY_PLAN_PROPERTY]: "2026-08-08T14:45",
      },
    });

    expect(getDailyPlanTime(habit, "2026-08-09")).toBeNull();
    expect(isPlanningQueueEntry(habit, "2026-08-09")).toBe(true);
  });

  it("does not apply habit planning metadata to an ordinary task", () => {
    const task = todo({
      properties: { [DAILY_PLAN_PROPERTY]: "2026-08-09T14:45" },
      scheduled: { date: "2026-08-09" },
    });

    expect(getPlannerTime(task, "2026-08-09")).toBeNull();
    expect(isPlanningQueueEntry(task, "2026-08-09")).toBe(true);
  });

  it("formats a date-specific daily plan value", () => {
    expect(buildDailyPlanValue("2026-08-09", { hours: 9, minutes: 5 })).toBe(
      "2026-08-09T09:05",
    );
  });

  it("shifts a planner time in either direction by a shared minute delta", () => {
    expect(shiftScheduleTime({ hours: 14, minutes: 15 }, -45)).toEqual({
      hours: 13,
      minutes: 30,
    });
    expect(shiftScheduleTime({ hours: 14, minutes: 15 }, 45)).toEqual({
      hours: 15,
      minutes: 0,
    });
    expect(scheduleTimeToMinutes({ hours: 13, minutes: 30 })).toBe(810);
  });

  it("rejects shifts that cross a day boundary", () => {
    expect(shiftScheduleTime({ hours: 0, minutes: 15 }, -30)).toBeNull();
    expect(shiftScheduleTime({ hours: 23, minutes: 45 }, 30)).toBeNull();
  });
});
