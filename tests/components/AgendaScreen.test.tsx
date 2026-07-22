/**
 * Tests for the Agenda Screen functionality
 *
 * These tests verify:
 * - Agenda rendering with entries
 * - Loading state
 * - Error handling
 * - Empty state
 * - Date navigation
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3LightTheme, PaperProvider } from "react-native-paper";
import { FilterProvider } from "../../context/FilterContext";
import { SnackbarProvider } from "../../context/SnackbarContext";
import { buildServerIdentity, queryKeys } from "../../hooks/queryKeys";
import { formatLocalDate } from "../../utils/dateFormatting";

// Import after mocks are set up
import { useApi } from "../../context/ApiContext";
import { useAuth } from "../../context/AuthContext";

// Import the actual screen component
import AgendaScreen from "../../app/(tabs)/index";

// Mock the modules before importing the component
jest.mock("../../services/api");
jest.mock("../../context/AuthContext");
jest.mock("../../context/ApiContext");
jest.mock("../../components/HabitGraph", () => ({
  HabitGraph: () => null,
}));
jest.mock("../../context/ColorPaletteContext", () => ({
  useColorPalette: () => ({
    getTodoStateColor: (keyword: string) => "#888888",
    getActionColor: (action: string) => "#666666",
    getPriorityColor: (priority: string) => "#444444",
  }),
}));
jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () => null,
  };
});
jest.mock("../../context/TemplatesContext", () => ({
  useTemplates: () => ({
    templates: null,
    filterOptions: {
      tags: ["work", "home"],
      todoStates: ["TODO", "NEXT", "DONE"],
      priorities: ["A", "B", "C"],
      categories: ["inbox", "projects"],
    },
    todoStates: { active: ["TODO", "NEXT"], done: ["DONE"] },
    customViews: null,
    isLoading: false,
    error: null,
    reloadTemplates: jest.fn(),
  }),
}));
jest.mock("../../context/SettingsContext", () => ({
  useSettings: () => ({
    quickScheduleIncludeTime: false,
    setQuickScheduleIncludeTime: jest.fn(),
    groupByCategory: false,
    setGroupByCategory: jest.fn(),
    multiDayRangeLength: 7,
    setMultiDayRangeLength: jest.fn(),
    multiDayPastDays: 1,
    setMultiDayPastDays: jest.fn(),
    showHabitsInAgenda: true,
    setShowHabitsInAgenda: jest.fn(),
    isLoading: false,
  }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
}));

// Create mock API object that we can reference in tests
const mockApi = {
  getAgenda: jest.fn(),
  getTodoStates: jest.fn(),
  getAllHabitStatuses: jest.fn(),
  getHabitStatus: jest.fn(),
};

// Mock data
const mockAgendaEntries = [
  {
    id: "1",
    title: "Morning standup",
    todo: "TODO",
    tags: ["work", "meeting"],
    level: 1,
    scheduled: { date: "2024-06-15", time: "09:00" },
    deadline: null,
    priority: null,
    file: "/test/work.org",
    pos: 100,
    olpath: null,
    notifyBefore: null,
    agendaLine: "Scheduled:  TODO Morning standup",
  },
  {
    id: "2",
    title: "Submit report",
    todo: "NEXT",
    tags: ["work"],
    level: 1,
    scheduled: null,
    deadline: { date: "2024-06-15", time: "17:00" },
    priority: "A",
    file: "/test/work.org",
    pos: 200,
    olpath: null,
    notifyBefore: null,
    agendaLine: "Deadline:   NEXT [#A] Submit report",
  },
  {
    id: "3",
    title: "Completed task",
    todo: "DONE",
    tags: null,
    level: 1,
    scheduled: { date: "2024-06-15", time: "10:00" },
    deadline: null,
    priority: null,
    file: "/test/inbox.org",
    pos: 300,
    olpath: null,
    notifyBefore: null,
    agendaLine: "Scheduled:  DONE Completed task",
    completedAt: "2024-06-15T10:30:00",
  },
];

// Mock response uses multi-day format since frontend now uses multi-day endpoint
// even for single-day view to get prospective habit scheduling
const mockAgendaResponse = {
  span: "week",
  startDate: "2024-06-15",
  endDate: "2024-06-15",
  today: "2024-06-15",
  days: {
    "2024-06-15": mockAgendaEntries,
  },
};

// Setup mocks
beforeEach(async () => {
  jest.clearAllMocks();

  // Mock useAuth
  (useAuth as jest.Mock).mockReturnValue({
    apiUrl: "http://test-api.local",
    username: "testuser",
    password: "testpass",
    isAuthenticated: true,
  });

  // Reset mock API methods
  mockApi.getAgenda.mockReset();
  mockApi.getTodoStates.mockReset();
  mockApi.getAllHabitStatuses.mockReset();
  mockApi.getHabitStatus.mockReset();

  // Set default mock implementations
  // Use mockImplementation to return entries for whatever date is requested
  mockApi.getAgenda.mockImplementation(
    (
      _span: string,
      startDate: string,
      _includeOverdue: boolean,
      _includeCompleted: boolean,
      endDate?: string,
    ) => {
      const date = startDate || "2024-06-15";
      return Promise.resolve({
        span: "week",
        startDate: date,
        endDate: endDate || date,
        today: date,
        days: {
          [date]: mockAgendaEntries,
        },
      });
    },
  );
  mockApi.getTodoStates.mockResolvedValue({
    active: ["TODO", "NEXT", "WAITING"],
    done: ["DONE", "CANCELLED"],
  });
  mockApi.getAllHabitStatuses.mockResolvedValue({
    status: "ok",
    habits: [],
  });
  mockApi.getHabitStatus.mockResolvedValue({
    status: "ok",
    id: "habit-1",
    title: "Habit",
    habit: {
      assessmentInterval: { days: 1 },
      rescheduleInterval: { days: 1 },
      rescheduleThreshold: 1,
      maxRepetitionsPerInterval: 1,
      startTime: "2024-01-01T00:00:00",
      windowSpecs: [],
    },
    currentState: {
      conformingRatio: 1,
      completionNeededToday: false,
      nextRequiredInterval: "2024-06-16",
      completionsInWindow: 0,
      targetRepetitions: 1,
      miniGraph: [],
    },
    doneTimes: [],
    graph: [],
  });

  (useApi as jest.Mock).mockReturnValue(mockApi);
});

// Fresh query cache per test so cached agendas can't leak between tests.
// gcTime Infinity avoids long-lived GC timers keeping the test env alive;
// retry: false matches the app's defaults (the API client retries itself).
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

// Helper to render with providers
const renderScreen = (
  component: React.ReactElement,
  queryClient: QueryClient = createTestQueryClient(),
) => {
  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={MD3LightTheme}>
          <SnackbarProvider>
            <FilterProvider>{component}</FilterProvider>
          </SnackbarProvider>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>,
  );
};

describe("AgendaScreen", () => {
  it("should render loading state initially", async () => {
    // Make getAgenda hang to test loading state
    mockApi.getAgenda.mockImplementation(() => new Promise(() => {}));

    const { getByTestId, queryByTestId } = renderScreen(<AgendaScreen />);

    // Should show loading indicator
    expect(getByTestId("agendaLoadingIndicator")).toBeTruthy();
    expect(queryByTestId("agendaList")).toBeNull();
  });

  it("should render agenda entries after loading", async () => {
    const { getByText, getByTestId } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByTestId("agendaScreen")).toBeTruthy();
    });

    // Active entries (TODO/NEXT) should be visible
    await waitFor(() => {
      expect(getByText("Morning standup")).toBeTruthy();
      expect(getByText("Submit report")).toBeTruthy();
    });
    // Completed entries are hidden by default when viewing today's date
  });

  it("should render todo states for entries", async () => {
    const { getByText, getAllByText } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByText("Morning standup")).toBeTruthy();
    });

    // Check active todo states are rendered (DONE items are hidden by default for today)
    await waitFor(() => {
      expect(getByText("TODO")).toBeTruthy();
      expect(getByText("NEXT")).toBeTruthy();
    });
  });

  it("should render tags for entries", async () => {
    const { getByText, getAllByText } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByText("Morning standup")).toBeTruthy();
    });

    await waitFor(() => {
      // Tags are rendered with colons, e.g., ":work:"
      expect(getAllByText(":work:").length).toBeGreaterThan(0);
      expect(getByText(":meeting:")).toBeTruthy();
    });
  });

  it("should show empty state when no entries", async () => {
    mockApi.getAgenda.mockImplementation(
      (
        _span: string,
        startDate: string,
        _includeOverdue: boolean,
        _includeCompleted: boolean,
        endDate?: string,
      ) => {
        const date = startDate || "2024-06-15";
        return Promise.resolve({
          span: "week",
          startDate: date,
          endDate: endDate || date,
          today: date,
          days: {
            [date]: [],
          },
        });
      },
    );

    const { getByText, getByTestId } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByTestId("agendaEmptyView")).toBeTruthy();
      expect(getByText("No items for today")).toBeTruthy();
    });
  });

  it("should show the full-screen error view when there is no data at all", async () => {
    mockApi.getAgenda.mockRejectedValue(new Error("Network error"));

    const { getByText, getByTestId } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByTestId("agendaErrorView")).toBeTruthy();
      expect(getByText("Failed to load agenda")).toBeTruthy();
    });
  });

  it("keeps existing data and shows a banner when a refresh fails", async () => {
    const { getByText, getByTestId, queryByTestId } = renderScreen(
      <AgendaScreen />,
    );

    await waitFor(() => {
      expect(getByText("Morning standup")).toBeTruthy();
    });

    // Make the next fetch fail and trigger a refresh
    mockApi.getAgenda.mockRejectedValue(new Error("Network error"));
    fireEvent.press(getByTestId("agendaRefreshButton"));

    await waitFor(() => {
      expect(getByTestId("agendaStaleBanner")).toBeTruthy();
    });

    // Existing data is still rendered; no full-screen error
    expect(getByText("Morning standup")).toBeTruthy();
    expect(getByText("Submit report")).toBeTruthy();
    expect(queryByTestId("agendaErrorView")).toBeNull();
    expect(queryByTestId("agendaErrorText")).toBeNull();
  });

  it("clears the failure banner after a successful retry", async () => {
    const { getByText, getByTestId, queryByTestId } = renderScreen(
      <AgendaScreen />,
    );

    await waitFor(() => {
      expect(getByText("Morning standup")).toBeTruthy();
    });

    const workingImplementation = mockApi.getAgenda.getMockImplementation();
    mockApi.getAgenda.mockRejectedValue(new Error("Network error"));
    fireEvent.press(getByTestId("agendaRefreshButton"));

    await waitFor(() => {
      expect(getByTestId("agendaStaleBanner")).toBeTruthy();
    });

    mockApi.getAgenda.mockImplementation(workingImplementation);

    // Wait for the failed refresh to fully settle (the retry button is
    // disabled while a refresh is in flight), then retry.
    await waitFor(() => {
      expect(getByTestId("agendaStaleBannerRetry")).toBeEnabled();
    });
    const callsBefore = mockApi.getAgenda.mock.calls.length;
    fireEvent.press(getByTestId("agendaStaleBannerRetry"));

    await waitFor(() => {
      expect(mockApi.getAgenda.mock.calls.length).toBeGreaterThan(callsBefore);
    });
    await waitFor(() => {
      expect(queryByTestId("agendaStaleBanner")).toBeNull();
    });
    expect(getByText("Morning standup")).toBeTruthy();
  });

  it("clears a stale failure banner when navigating to another date", async () => {
    const { getByText, getByTestId, queryByTestId } = renderScreen(
      <AgendaScreen />,
    );

    await waitFor(() => {
      expect(getByText("Morning standup")).toBeTruthy();
    });

    // Fail a refresh of the current view so the stale banner shows.
    mockApi.getAgenda.mockRejectedValue(new Error("Network error"));
    fireEvent.press(getByTestId("agendaRefreshButton"));

    await waitFor(() => {
      expect(getByTestId("agendaStaleBanner")).toBeTruthy();
    });

    // Navigate to the next (uncached) day while its fetch hangs: the old
    // view's banner must not render over the new view.
    mockApi.getAgenda.mockImplementation(() => new Promise(() => {}));
    fireEvent.press(getByTestId("agendaNextDay"));

    await waitFor(() => {
      expect(queryByTestId("agendaStaleBanner")).toBeNull();
    });
    // With no cache for the new date, the previous day's data is cleared and
    // the full-screen spinner shows instead of another date's entries.
    await waitFor(() => {
      expect(getByTestId("agendaLoadingIndicator")).toBeTruthy();
    });
  });

  it("clears the previous view's data and shows the full-screen error when an uncached date fails to load", async () => {
    const { getByText, queryByText, getByTestId, queryByTestId } = renderScreen(
      <AgendaScreen />,
    );

    await waitFor(() => {
      expect(getByText("Morning standup")).toBeTruthy();
    });

    // Navigating to an uncached date whose fetch fails must not leave the
    // previous date's entries on screen.
    mockApi.getAgenda.mockRejectedValue(new Error("Network error"));
    fireEvent.press(getByTestId("agendaNextDay"));

    await waitFor(() => {
      expect(getByTestId("agendaErrorView")).toBeTruthy();
    });
    expect(queryByText("Morning standup")).toBeNull();
    expect(queryByTestId("agendaStaleBanner")).toBeNull();
  });

  it("renders cached data immediately when the server is unreachable", async () => {
    const today = formatLocalDate(new Date());
    const identity = buildServerIdentity("http://test-api.local", "testuser")!;
    const queryClient = createTestQueryClient();

    // Simulate a cache restored from a previous session (the persisted query
    // cache in the app): seed the exact key the agenda view uses.
    queryClient.setQueryData(
      queryKeys.agendaView(identity, {
        mode: "day",
        dateString: today,
        rangeLength: 1,
        includeCompleted: false,
      }),
      {
        span: "week",
        startDate: today,
        endDate: today,
        today,
        days: {
          [today]: [
            {
              id: "cached-1",
              title: "Cached task",
              todo: "TODO",
              tags: null,
              level: 1,
              scheduled: null,
              deadline: null,
              priority: null,
              file: "/test/cached.org",
              pos: 100,
              olpath: null,
              notifyBefore: null,
              agendaLine: "Scheduled:  TODO Cached task",
              category: null,
              effectiveCategory: null,
            },
          ],
        },
      },
    );
    queryClient.setQueryData(queryKeys.todoStates(identity), {
      active: ["TODO", "NEXT"],
      done: ["DONE"],
    });

    // The network never responds
    mockApi.getAgenda.mockImplementation(() => new Promise(() => {}));
    mockApi.getTodoStates.mockImplementation(() => new Promise(() => {}));
    mockApi.getAllHabitStatuses.mockImplementation(() => new Promise(() => {}));

    const { getByText, queryByTestId } = renderScreen(
      <AgendaScreen />,
      queryClient,
    );

    await waitFor(() => {
      expect(getByText("Cached task")).toBeTruthy();
    });
    expect(queryByTestId("agendaLoadingIndicator")).toBeNull();
    expect(queryByTestId("agendaErrorView")).toBeNull();
  });

  it("should call API with correct date", async () => {
    const { getByTestId } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByTestId("agendaScreen")).toBeTruthy();
    });

    // Now uses multi-day endpoint with same start/end date for prospective habits
    expect(mockApi.getAgenda).toHaveBeenCalledWith(
      "week",
      expect.any(String),
      expect.any(Boolean),
      expect.any(Boolean),
      expect.any(String), // endDate (same as startDate)
    );
  });

  it("should display the date header", async () => {
    const { getByTestId, getByText } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByTestId("agendaDateHeader")).toBeTruthy();
    });

    // The date header should contain the date
    const dateHeader = getByTestId("agendaDateHeader");
    expect(dateHeader).toBeTruthy();
  });

  it("should have navigation buttons", async () => {
    const { getByTestId } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByTestId("agendaScreen")).toBeTruthy();
    });

    expect(getByTestId("agendaPrevDay")).toBeTruthy();
    expect(getByTestId("agendaNextDay")).toBeTruthy();
  });
});

describe("AgendaScreen Data Processing", () => {
  it("should format scheduled timestamps", async () => {
    const { getByText, getAllByText } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByText("Morning standup")).toBeTruthy();
    });

    // Should show "S:" prefix for scheduled (multiple entries have scheduled times)
    await waitFor(() => {
      expect(getAllByText(/^S:/).length).toBeGreaterThan(0);
    });
  });

  it("should format deadline timestamps", async () => {
    const { getByText } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByText("Submit report")).toBeTruthy();
    });

    // Should show "D:" prefix for deadline
    await waitFor(() => {
      expect(getByText(/^D:/)).toBeTruthy();
    });
  });

  it("shows completed habits for past dates based on habit status graph", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2024-06-16T12:00:00"));

    try {
      mockApi.getAgenda.mockImplementation(
        (
          _span: string,
          startDate: string,
          _includeOverdue: boolean,
          _includeCompleted: boolean,
          endDate?: string,
        ) =>
          Promise.resolve({
            span: "week",
            startDate,
            endDate: endDate || startDate,
            today: "2024-06-16",
            days: {
              [startDate]: [],
            },
          }),
      );

      mockApi.getAllHabitStatuses.mockResolvedValue({
        status: "ok",
        habits: [
          {
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
            currentState: {
              conformingRatio: 1,
              completionNeededToday: false,
              nextRequiredInterval: "2024-06-16",
              completionsInWindow: 1,
              targetRepetitions: 1,
              miniGraph: [],
            },
            doneTimes: [],
            graph: [
              {
                date: "2024-06-15",
                assessmentStart: "2024-06-15T00:00:00",
                assessmentEnd: "2024-06-16T00:00:00",
                conformingRatioWithout: 1,
                conformingRatioWith: 1,
                completionCount: 1,
                status: "past",
                completionExpectedToday: false,
              },
            ],
          },
        ],
      });

      const { getByTestId, findByText } = renderScreen(<AgendaScreen />);

      await waitFor(() => {
        expect(getByTestId("agendaScreen")).toBeTruthy();
      });

      fireEvent.press(getByTestId("agendaPrevDay"));

      expect(await findByText("Floss")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
