// The completion path pulls in expo-notifications through
// services/notifications; stub that layer so it runs in the Node unit
// environment.
jest.mock("@/services/notifications", () => ({
  cancelScheduledNotificationsForTodoOnDate: jest.fn().mockResolvedValue(0),
  scheduleNotificationsFromServer: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/notificationHorizonConfig", () => ({
  getNotificationHorizonMinutes: jest.fn().mockResolvedValue(60),
}));

import { OrgAgendaApi } from "@/services/api";
import {
  buildTodoStub,
  completeTodoWithNotificationSync,
} from "@/services/todoCompletion";
import { completionTimeForDayBoundary } from "@/utils/dateFormatting";

describe("completionTimeForDayBoundary", () => {
  it("leaves the time alone when the day is not extended", () => {
    const now = new Date(2026, 0, 15, 1, 30);
    expect(completionTimeForDayBoundary(now, 0)).toBe(now);
  });

  it("leaves the time alone once past the extension hour", () => {
    const now = new Date(2026, 0, 15, 4, 0);
    expect(completionTimeForDayBoundary(now, 4)).toBe(now);
  });

  it("moves earlier times to the end of the previous day", () => {
    const shifted = completionTimeForDayBoundary(
      new Date(2026, 0, 15, 1, 30),
      4,
    );
    expect(shifted).toEqual(new Date(2026, 0, 14, 23, 59, 0, 0));
  });
});

describe("completeTodoWithNotificationSync", () => {
  const todo = buildTodoStub({ id: "abc", title: "Write tests" });

  function makeApi() {
    return {
      setTodoState: jest.fn().mockResolvedValue({ status: "completed" }),
      getNotifications: jest.fn().mockResolvedValue({ notifications: [] }),
    } as unknown as OrgAgendaApi & { setTodoState: jest.Mock };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it("sends the previous day's end for a late-night completion", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 15, 1, 30));
    const api = makeApi();

    await completeTodoWithNotificationSync(api, todo, "DONE", {
      useClientCompletionTime: true,
      extendTodayUntilHour: 4,
    });

    expect(api.setTodoState).toHaveBeenCalledWith(
      todo,
      "DONE",
      "2026-01-14 23:59",
    );
  });

  it("shifts even when client completion time is disabled", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 15, 1, 30));
    const api = makeApi();

    await completeTodoWithNotificationSync(api, todo, "DONE", {
      useClientCompletionTime: false,
      extendTodayUntilHour: 4,
    });

    expect(api.setTodoState).toHaveBeenCalledWith(
      todo,
      "DONE",
      "2026-01-14 23:59",
    );
  });

  it("defers to the server outside the extended window", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 15, 9, 0));
    const api = makeApi();

    await completeTodoWithNotificationSync(api, todo, "DONE", {
      useClientCompletionTime: false,
      extendTodayUntilHour: 4,
    });

    expect(api.setTodoState).toHaveBeenCalledWith(todo, "DONE", undefined);
  });

  it("keeps an explicit override date at noon", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 15, 1, 30));
    const api = makeApi();

    await completeTodoWithNotificationSync(api, todo, "DONE", {
      overrideDate: new Date(2026, 0, 10, 8, 0),
      extendTodayUntilHour: 4,
    });

    expect(api.setTodoState).toHaveBeenCalledWith(
      todo,
      "DONE",
      "2026-01-10 12:00",
    );
  });
});
