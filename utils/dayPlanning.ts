import { Timestamp, Todo } from "@/services/api";

export interface ScheduleTime {
  hours: number;
  minutes: number;
}

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
