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

import { render, waitFor } from "@testing-library/react-native";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3LightTheme, PaperProvider } from "react-native-paper";
import { FilterProvider } from "../../context/FilterContext";

// Import after mocks are set up
import { useApi } from "../../context/ApiContext";
import { useAuth } from "../../context/AuthContext";

// Import the actual screen component
import AgendaScreen from "../../app/(tabs)/index";

// Mock the modules before importing the component
jest.mock("../../services/api");
jest.mock("../../context/AuthContext");
jest.mock("../../context/ApiContext");
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
jest.mock("../../context/MutationContext", () => ({
  MutationProvider: ({ children }: { children: React.ReactNode }) => children,
  useMutation: () => ({
    mutationVersion: 0,
    triggerRefresh: jest.fn(),
  }),
}));
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
beforeEach(() => {
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

  (useApi as jest.Mock).mockReturnValue(mockApi);
});

// Helper to render with providers
const renderScreen = (component: React.ReactElement) => {
  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={MD3LightTheme}>
        <FilterProvider>{component}</FilterProvider>
      </PaperProvider>
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

  it("should handle API errors gracefully", async () => {
    mockApi.getAgenda.mockRejectedValue(new Error("Network error"));

    const { getByText, getByTestId } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByTestId("agendaErrorView")).toBeTruthy();
      expect(getByText("Failed to load agenda")).toBeTruthy();
    });
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
});
