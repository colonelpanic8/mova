/**
 * Tests for the useAgendaData hook: query-key discipline (per server
 * identity, mode, date, range, completed-visibility) and the derived
 * single-day view plus optimistic in-view updates. These port the meaningful
 * behaviors previously covered by the deleted agendaCache tests.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import { useApi } from "../../context/ApiContext";
import { useAuth } from "../../context/AuthContext";
import { buildServerIdentity, queryKeys } from "../../hooks/queryKeys";
import { useAgendaData } from "../../hooks/useAgendaData";
import type { MultiDayAgendaResponse } from "../../services/api";

jest.mock("../../context/ApiContext");
jest.mock("../../context/AuthContext");

const mockApi = {
  getAgenda: jest.fn(),
};

const buildEntry = (id: string, title: string, extra: object = {}) => ({
  id,
  title,
  todo: "TODO",
  tags: null,
  level: 1,
  scheduled: null,
  deadline: null,
  priority: null,
  file: "/test/work.org",
  pos: 100,
  olpath: null,
  notifyBefore: null,
  agendaLine: `Scheduled:  TODO ${title}`,
  category: null,
  effectiveCategory: null,
  ...extra,
});

const buildResponse = (
  days: MultiDayAgendaResponse["days"],
): MultiDayAgendaResponse => {
  const dates = Object.keys(days).sort();
  return {
    span: "week",
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    today: dates[0],
    days,
  } as MultiDayAgendaResponse;
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

const identity = buildServerIdentity("http://test-api.local", "testuser")!;

describe("useAgendaData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      apiUrl: "http://test-api.local",
      username: "testuser",
      isAuthenticated: true,
    });
    (useApi as jest.Mock).mockReturnValue(mockApi);
    mockApi.getAgenda.mockImplementation(
      (
        _span: string,
        startDate: string,
        _includeOverdue: boolean,
        _includeCompleted: boolean,
        endDate?: string,
      ) =>
        Promise.resolve(
          buildResponse({
            [startDate]: [buildEntry(`id-${startDate}`, `Task ${startDate}`)],
            ...(endDate && endDate !== startDate ? { [endDate]: [] } : {}),
          }),
        ),
    );
  });

  type AgendaHookProps = Parameters<typeof useAgendaData>[0];

  const renderAgendaHook = (
    queryClient: QueryClient,
    initialProps: AgendaHookProps,
  ) =>
    renderHook((props: AgendaHookProps) => useAgendaData(props), {
      initialProps,
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

  it("falls back to the single-day endpoint when the server rejects multi-day requests", async () => {
    const queryClient = createTestQueryClient();
    const date = new Date(2026, 6, 9); // 2026-07-09 local time

    const { ApiError } = jest.requireActual("../../services/api");
    mockApi.getAgenda.mockImplementation((span: string, startDate: string) => {
      if (span === "week") {
        return Promise.reject(new ApiError(500));
      }
      return Promise.resolve({
        span: "day",
        date: startDate,
        entries: [buildEntry(`id-${startDate}`, `Task ${startDate}`)],
      });
    });

    const { result } = renderAgendaHook(queryClient, {
      mode: "day",
      date,
      rangeLength: 7,
      includeCompleted: false,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.agenda?.entries.map((e) => e.title)).toEqual([
      "Task 2026-07-09",
    ]);
    expect(mockApi.getAgenda).toHaveBeenCalledWith(
      "day",
      "2026-07-09",
      true,
      false,
    );
  });

  it("derives the single-day view from the multi-day payload and caches it under an identity-scoped view key", async () => {
    const queryClient = createTestQueryClient();
    const date = new Date(2026, 6, 9); // 2026-07-09 local time

    const { result } = renderAgendaHook(queryClient, {
      mode: "day",
      date,
      rangeLength: 7,
      includeCompleted: false,
    });

    await waitFor(() => {
      expect(result.current.agenda).not.toBeNull();
    });

    expect(result.current.agenda).toEqual({
      span: "day",
      date: "2026-07-09",
      entries: [buildEntry("id-2026-07-09", "Task 2026-07-09")],
    });
    expect(result.current.multiDayData).toBeNull();

    // Day mode normalizes rangeLength to 1 so day keys never fragment.
    const expectedKey = queryKeys.agendaView(identity, {
      mode: "day",
      dateString: "2026-07-09",
      rangeLength: 1,
      includeCompleted: false,
    });
    expect(queryClient.getQueryData(expectedKey)).toBeDefined();
    // Another server identity has no data under its own key.
    expect(
      queryClient.getQueryData(
        queryKeys.agendaView(buildServerIdentity("http://other", "someone")!, {
          mode: "day",
          dateString: "2026-07-09",
          rangeLength: 1,
          includeCompleted: false,
        }),
      ),
    ).toBeUndefined();
  });

  it("caches each view (mode, date, completed) independently", async () => {
    const queryClient = createTestQueryClient();
    const date = new Date(2026, 6, 9);

    const { result, rerender } = renderAgendaHook(queryClient, {
      mode: "day",
      date,
      rangeLength: 7,
      includeCompleted: false,
    });
    await waitFor(() => expect(result.current.agenda).not.toBeNull());

    // Same date with completed shown is a different view -> refetches.
    rerender({ mode: "day", date, rangeLength: 7, includeCompleted: true });
    await waitFor(() => expect(mockApi.getAgenda).toHaveBeenCalledTimes(2));

    // Multiday over the same start date is another view again.
    rerender({
      mode: "multiday",
      date,
      rangeLength: 7,
      includeCompleted: true,
    });
    await waitFor(() => expect(mockApi.getAgenda).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.multiDayData).not.toBeNull());

    const cachedKeys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    expect(cachedKeys).toContainEqual([
      identity,
      "agenda",
      "day",
      "2026-07-09",
      1,
      false,
    ]);
    expect(cachedKeys).toContainEqual([
      identity,
      "agenda",
      "day",
      "2026-07-09",
      1,
      true,
    ]);
    expect(cachedKeys).toContainEqual([
      identity,
      "agenda",
      "multiday",
      "2026-07-09",
      7,
      true,
    ]);
  });

  it("updates a todo in place and removes it from a day view when rescheduled to another date", async () => {
    const queryClient = createTestQueryClient();
    const date = new Date(2026, 6, 9);
    const entry = buildEntry("id-2026-07-09", "Task 2026-07-09");

    const { result } = renderAgendaHook(queryClient, {
      mode: "day",
      date,
      rangeLength: 7,
      includeCompleted: false,
    });
    await waitFor(() => expect(result.current.agenda).not.toBeNull());

    // In-place update (e.g. state change) keeps the entry.
    await act(async () => {
      result.current.updateTodoInView(entry, { todo: "DONE" });
    });
    await waitFor(() => {
      expect(result.current.agenda?.entries[0]?.todo).toBe("DONE");
    });

    // Rescheduling to another date removes it from this day view.
    await act(async () => {
      result.current.updateTodoInView(entry, {
        scheduled: { date: "2026-07-10" },
      });
    });
    await waitFor(() => {
      expect(result.current.agenda?.entries).toHaveLength(0);
    });
  });
});
