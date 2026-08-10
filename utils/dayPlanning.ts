import { DateRelevance, Timestamp, Todo } from "@/services/api";
import { isHabitTodo } from "@/utils/habits";

type PlanningEntry = Todo & { dateRelevance?: DateRelevance };

export interface ScheduleTime {
  hours: number;
  minutes: number;
}

export function scheduleTimeToMinutes(time: ScheduleTime): number {
  return time.hours * 60 + time.minutes;
}

export function shiftScheduleTimeEarlier(
  time: ScheduleTime,
  deltaMinutes: number,
): ScheduleTime | null {
  if (!Number.isInteger(deltaMinutes) || deltaMinutes <= 0) return null;

  const shiftedMinutes = scheduleTimeToMinutes(time) - deltaMinutes;
  if (shiftedMinutes < 0) return null;

  return {
    hours: Math.floor(shiftedMinutes / 60),
    minutes: shiftedMinutes % 60,
  };
}

export const DAILY_PLAN_PROPERTY = "MOVA_PLANNED_AT";

interface DropTimeOptions {
  dropY: number;
  viewportTop: number;
  viewportHeight: number;
  scrollOffset: number;
  startHour: number;
  endHour: number;
  hourHeight: number;
  snapMinutes?: number;
}

export function getTimeFromEntry(entry: Todo): ScheduleTime | null {
  for (const timestamp of [entry.scheduled, entry.deadline]) {
    if (!timestamp?.time) continue;

    const [hours, minutes] = timestamp.time.split(":").map(Number);
    if (
      Number.isInteger(hours) &&
      Number.isInteger(minutes) &&
      hours >= 0 &&
      hours < 24 &&
      minutes >= 0 &&
      minutes < 60
    ) {
      return { hours, minutes };
    }
  }

  return null;
}

function parseTime(value: string | undefined): ScheduleTime | null {
  if (!value) return null;

  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours >= 24 || minutes >= 60) return null;

  return { hours, minutes };
}

export function getDailyPlanTime(
  entry: Todo,
  date: string,
): ScheduleTime | null {
  const value = entry.properties?.[DAILY_PLAN_PROPERTY];
  if (!value?.startsWith(`${date}T`)) return null;
  return parseTime(value);
}

export function getPlannerTime(entry: Todo, date: string): ScheduleTime | null {
  return isHabitTodo(entry)
    ? (getDailyPlanTime(entry, date) ?? getTimeFromEntry(entry))
    : getTimeFromEntry(entry);
}

export function buildDailyPlanValue(date: string, time: ScheduleTime): string {
  return `${date}T${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`;
}

export function getSnappedDropTime({
  dropY,
  viewportTop,
  viewportHeight,
  scrollOffset,
  startHour,
  endHour,
  hourHeight,
  snapMinutes = 15,
}: DropTimeOptions): ScheduleTime | null {
  if (
    dropY < viewportTop ||
    dropY > viewportTop + viewportHeight ||
    hourHeight <= 0 ||
    snapMinutes <= 0 ||
    endHour <= startHour
  ) {
    return null;
  }

  const contentY = dropY - viewportTop + scrollOffset;
  const rawMinutes = startHour * 60 + (contentY / hourHeight) * 60;
  const snappedMinutes = Math.round(rawMinutes / snapMinutes) * snapMinutes;
  const firstMinute = startHour * 60;
  const lastMinute = endHour * 60 - snapMinutes;
  const totalMinutes = Math.max(
    firstMinute,
    Math.min(lastMinute, snappedMinutes),
  );

  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function buildScheduledTimestamp(
  todo: Todo,
  date: string,
  time: ScheduleTime,
): Timestamp {
  return {
    date,
    time: `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`,
    ...(todo.scheduled?.repeater ? { repeater: todo.scheduled.repeater } : {}),
  };
}

export function isPlanningQueueEntry(
  todo: PlanningEntry,
  date: string,
): boolean {
  if (getPlannerTime(todo, date)) return false;

  return Boolean(
    isHabitTodo(todo) ||
    todo.dateRelevance === "habit_required" ||
    todo.dateRelevance === "overdue" ||
    (todo.scheduled?.date && todo.scheduled.date <= date),
  );
}
