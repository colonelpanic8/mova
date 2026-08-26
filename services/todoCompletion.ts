import { CompleteTodoResponse, OrgAgendaApi, Todo } from "@/services/api";
import { getNotificationHorizonMinutes } from "@/services/notificationHorizonConfig";
import {
  cancelScheduledNotificationsForTodoOnDate,
  scheduleNotificationsFromServer,
} from "@/services/notifications";
import {
  completionTimeForDayBoundary,
  formatLocalDateTime,
} from "@/utils/dateFormatting";

/**
 * Build a minimal Todo for API calls that only need to identify a todo
 * (by id or file/pos) rather than carry its full contents.
 */
export function buildTodoStub(fields: Partial<Todo>): Todo {
  return {
    id: null,
    file: null,
    pos: null,
    title: "",
    todo: "",
    tags: null,
    level: 0,
    scheduled: null,
    deadline: null,
    priority: null,
    olpath: null,
    notifyBefore: null,
    category: null,
    effectiveCategory: null,
    ...fields,
  };
}

export interface CompleteTodoOptions {
  /** Place the completion on this date (normalized to noon local time). */
  overrideDate?: Date | null;
  /** When no overrideDate is given, send the client's current time. */
  useClientCompletionTime?: boolean;
  /**
   * org-extend-today-until: until this hour, a completion with no explicit
   * date is recorded at the end of the previous day. Applies even when
   * useClientCompletionTime is off, since the server's clock has already
   * rolled over.
   */
  extendTodayUntilHour?: number;
}

/**
 * Set a todo's state and keep local notifications consistent: on completion,
 * cancel any remaining notifications for the completion day and kick off a
 * best-effort background resync from the server (keeps repeating items and
 * future occurrences correct).
 */
export async function completeTodoWithNotificationSync(
  api: OrgAgendaApi,
  todo: Todo,
  state: string,
  options: CompleteTodoOptions = {},
): Promise<CompleteTodoResponse> {
  const {
    overrideDate,
    useClientCompletionTime,
    extendTodayUntilHour = 0,
  } = options;

  // Use override date if provided, otherwise use current datetime if enabled
  let overrideDateStr: string | undefined;
  const now = new Date();
  if (overrideDate) {
    // Set time to noon to clearly place the completion on the specified date
    const noonDate = new Date(overrideDate);
    noonDate.setHours(12, 0, 0, 0);
    overrideDateStr = formatLocalDateTime(noonDate);
  } else {
    const effectiveNow = completionTimeForDayBoundary(
      now,
      extendTodayUntilHour,
    );
    const inExtendedDay = effectiveNow !== now;
    if (useClientCompletionTime || inExtendedDay) {
      overrideDateStr = formatLocalDateTime(effectiveNow);
    }
  }

  const result = await api.setTodoState(todo, state, overrideDateStr);

  if (result.status === "completed") {
    // Cancel against the real current day: the extended-day shift only
    // changes what the server records, not which notifications are pending.
    const completionDay = overrideDate ?? now;
    try {
      await cancelScheduledNotificationsForTodoOnDate(todo, completionDay);
    } catch (e) {
      console.error(
        "[Notifications] Failed to cancel completed todo notifications:",
        e,
      );
    }
    // Best-effort resync to keep repeating items/future occurrences correct.
    void (async () => {
      try {
        const withinMinutes = await getNotificationHorizonMinutes();
        const response = await api.getNotifications({ withinMinutes });
        await scheduleNotificationsFromServer(response);
      } catch {
        // Ignore; local cancellation above handles "don't fire later today".
      }
    })();
  }

  return result;
}
