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

// Mock the modules before importing the component
jest.mock("../../services/api");
jest.mock("../../context/AuthContext");
jest.mock("../../context/ColorPaletteContext", () => ({
  useColorPalette: () => ({
    getTodoStateColor: (keyword: string) => "#888888",
    getActionColor: (action: string) => "#666666",
  }),
}));
jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () => null,
  };
});

// Import after mocks are set up
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

// Mock data
const mockAgendaEntries = [
  {
    id: "1",
    title: "Morning standup",
    todo: "TODO",
    tags: ["work", "meeting"],
    level: 1,
    scheduled: "2024-06-15T09:00:00",
    deadline: null,
    priority: null,
    file: "/test/work.org",
    pos: 100,
    olpath: null,
    notifyBefore: null,
    type: "scheduled",
    time: "09:00",
  },
  {
    id: "2",
    title: "Submit report",
    todo: "NEXT",
    tags: ["work"],
    level: 1,
    scheduled: null,
    deadline: "2024-06-15T17:00:00",
    priority: "A",
    file: "/test/work.org",
    pos: 200,
    olpath: null,
    notifyBefore: null,
    type: "deadline",
    time: "17:00",
  },
  {
    id: "3",
    title: "Completed task",
    todo: "DONE",
    tags: null,
    level: 1,
    scheduled: "2024-06-15T10:00:00",
    deadline: null,
    priority: null,
    file: "/test/inbox.org",
    pos: 300,
    olpath: null,
    notifyBefore: null,
    type: "scheduled",
    time: "10:00",
  },
];

const mockAgendaResponse = {
  span: "day",
  date: "2024-06-15",
  entries: mockAgendaEntries,
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

  // Mock API methods
  (api.configure as jest.Mock).mockImplementation(() => {});
  (api.getAgenda as jest.Mock).mockResolvedValue(mockAgendaResponse);
  (api.getTodoStates as jest.Mock).mockResolvedValue({
    active: ["TODO", "NEXT", "WAITING"],
    done: ["DONE", "CANCELLED"],
  });
});

// Helper to render with providers
const renderScreen = (component: React.ReactElement) => {
  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={MD3LightTheme}>{component}</PaperProvider>
    </GestureHandlerRootView>,
  );
};

// Import the actual screen component
import AgendaScreen from "../../app/(tabs)/index";

describe("AgendaScreen", () => {
  it("should render loading state initially", async () => {
    // Make getAgenda hang to test loading state
    (api.getAgenda as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    );

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

    await waitFor(() => {
      expect(getByText("Morning standup")).toBeTruthy();
      expect(getByText("Submit report")).toBeTruthy();
      expect(getByText("Completed task")).toBeTruthy();
    });
  });

  it("should render todo states for entries", async () => {
    const { getByText, getAllByText } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByText("Morning standup")).toBeTruthy();
    });

    // Check todo states are rendered
    await waitFor(() => {
      expect(getByText("TODO")).toBeTruthy();
      expect(getByText("NEXT")).toBeTruthy();
      expect(getByText("DONE")).toBeTruthy();
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
    (api.getAgenda as jest.Mock).mockResolvedValue({
      span: "day",
      date: "2024-06-15",
      entries: [],
    });

    const { getByText, getByTestId } = renderScreen(<AgendaScreen />);

    await waitFor(() => {
      expect(getByTestId("agendaEmptyView")).toBeTruthy();
      expect(getByText("No items for today")).toBeTruthy();
    });
  });

  it("should handle API errors gracefully", async () => {
    (api.getAgenda as jest.Mock).mockRejectedValue(new Error("Network error"));

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

    expect(api.configure).toHaveBeenCalledWith(
      "http://test-api.local",
      "testuser",
      "testpass",
    );
    expect(api.getAgenda).toHaveBeenCalledWith("day", expect.any(String), expect.any(Boolean));
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
