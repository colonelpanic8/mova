import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3LightTheme, PaperProvider } from "react-native-paper";

import ViewsScreen from "../../app/(tabs)/views";
import { useApi } from "../../context/ApiContext";
import { useAuth } from "../../context/AuthContext";

function mockScreenContainer({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  return <View testID={testID}>{children}</View>;
}

function mockTodoItem({ todo }: { todo: { title: string } }) {
  return <Text>{todo.title}</Text>;
}

function mockTodoEditingProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

jest.mock("../../context/ApiContext");
jest.mock("../../context/AuthContext");
jest.mock("../../context/FilterContext", () => ({
  useFilters: () => ({
    filters: {
      tags: { include: [], exclude: [] },
      states: [],
      priorities: [],
      dateRange: null,
      files: [],
      categories: [],
      showHabits: true,
    },
  }),
}));
jest.mock("../../hooks/useServerData", () => ({
  useTodoStates: () => ({ data: null }),
}));
jest.mock("../../components/FilterBar", () => ({
  FilterBar: () => null,
}));
jest.mock("../../components/ScreenContainer", () => ({
  ScreenContainer: mockScreenContainer,
}));
jest.mock("../../components/TodoItem", () => ({
  TodoItem: mockTodoItem,
}));
jest.mock("../../hooks/useTodoEditing", () => ({
  TodoEditingProvider: mockTodoEditingProvider,
}));

const mockApi = {
  getCustomViews: jest.fn(),
  getCustomView: jest.fn(),
};

const mockView = {
  key: "n",
  name: "Next actions",
  entries: [
    {
      id: "todo-1",
      title: "Recovered task",
      todo: "NEXT",
      file: "/tmp/test.org",
      pos: 1,
    },
  ],
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

const renderScreen = () =>
  render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={createTestQueryClient()}>
        <PaperProvider theme={MD3LightTheme}>
          <ViewsScreen />
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>,
  );

async function openView(
  getByTestId: (testID: string) => ReturnType<typeof render>["root"],
) {
  await waitFor(() => {
    expect(getByTestId("viewsList")).toBeTruthy();
  });
  fireEvent.press(getByTestId("viewItem-n"));
}

describe("ViewsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});

    mockApi.getCustomViews.mockResolvedValue({
      views: [{ key: "n", name: "Next actions" }],
    });
    mockApi.getCustomView.mockResolvedValue(mockView);

    (useApi as jest.Mock).mockReturnValue(mockApi);
    (useAuth as jest.Mock).mockReturnValue({
      apiUrl: "http://test-api.local",
      username: "testuser",
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("automatically retries a failed view entries request", async () => {
    jest.useFakeTimers();
    mockApi.getCustomView
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(mockView);

    const { getByTestId, getByText } = renderScreen();
    await openView(getByTestId);

    await waitFor(() => {
      expect(mockApi.getCustomView).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(750);
    });

    await waitFor(() => {
      expect(getByText("Recovered task")).toBeTruthy();
    });
    expect(mockApi.getCustomView).toHaveBeenCalledTimes(2);
  });

  it("offers retry and back controls after automatic retries fail", async () => {
    jest.useFakeTimers();
    mockApi.getCustomView.mockRejectedValue(new Error("Network error"));

    const { getByTestId, getByText } = renderScreen();
    await openView(getByTestId);

    await waitFor(() => {
      expect(mockApi.getCustomView).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(750);
    });

    await waitFor(() => {
      expect(getByText("Failed to load view entries")).toBeTruthy();
    });
    expect(getByTestId("viewBackButton")).toBeTruthy();

    mockApi.getCustomView.mockResolvedValue(mockView);
    fireEvent.press(getByTestId("viewRetryButton"));

    await waitFor(() => {
      expect(getByText("Recovered task")).toBeTruthy();
    });
    expect(mockApi.getCustomView).toHaveBeenCalledTimes(3);
  });
});
