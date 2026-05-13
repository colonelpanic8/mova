import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3LightTheme, PaperProvider } from "react-native-paper";

import HabitsScreen from "../../app/(tabs)/habits";
import { useApi } from "../../context/ApiContext";
import { useHabitConfig } from "../../context/HabitConfigContext";

jest.mock("../../context/ApiContext");
jest.mock("../../context/HabitConfigContext");
jest.mock("../../context/MutationContext", () => ({
  useMutation: () => ({
    mutationVersion: 0,
    triggerRefresh: jest.fn(),
  }),
}));
jest.mock("../../components/TodoItem", () => ({
  getTodoKey: (item: { id?: string; title?: string }) => item.id ?? item.title,
}));
jest.mock("../../components/HabitItem", () => ({
  HabitItem: ({
    todo,
    habitStatus,
  }: {
    todo: { title: string };
    habitStatus?: { title: string };
  }) => {
    const React = require("react");
    const { Text, View } = require("react-native");
    return (
      <View>
        <Text>{todo.title}</Text>
        {habitStatus ? <Text>{habitStatus.title}</Text> : null}
      </View>
    );
  },
}));
jest.mock("../../components/ScreenContainer", () => ({
  ScreenContainer: ({
    children,
    testID,
  }: {
    children: React.ReactNode;
    testID?: string;
  }) => {
    const React = require("react");
    const { View } = require("react-native");
    return <View testID={testID}>{children}</View>;
  },
}));
jest.mock("../../hooks/useTodoEditing", () => ({
  TodoEditingProvider: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    return <>{children}</>;
  },
}));

let mockRunFocusEffects = false;
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        if (mockRunFocusEffects) {
          return callback();
        }
        return undefined;
      }, [callback]);
    },
  };
});

const mockApi = {
  getAllTodos: jest.fn(),
  getAllHabitStatuses: jest.fn(),
};

const mockHabit = {
  id: "habit-1",
  title: "Drink water",
  todo: "TODO",
  isWindowHabit: true,
  properties: {},
  file: "/tmp/test.org",
  pos: 1,
  habitSummary: {
    completionNeededToday: true,
    conformingRatio: 1,
  },
};

const renderScreen = () =>
  render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={MD3LightTheme}>
        <HabitsScreen />
      </PaperProvider>
    </GestureHandlerRootView>,
  );

describe("HabitsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockRunFocusEffects = false;

    mockApi.getAllTodos.mockResolvedValue({ todos: [mockHabit] });
    mockApi.getAllHabitStatuses.mockResolvedValue({
      status: "ok",
      habits: [
        {
          id: "habit-1",
          title: "Drink water status",
        },
      ],
    });

    (useApi as jest.Mock).mockReturnValue(mockApi);
    (useHabitConfig as jest.Mock).mockReturnValue({
      config: { status: "ok", enabled: true },
      isLoading: false,
      error: null,
      colors: {},
      glyphs: {
        completionNeededToday: "todo",
        completed: "done",
        nextRequired: "todo",
      },
      refetch: jest.fn().mockResolvedValue(undefined),
      ensureFresh: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders habits even when the status endpoint fails", async () => {
    mockApi.getAllHabitStatuses.mockRejectedValue(new Error("Status failed"));

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText("Drink water")).toBeTruthy();
    });
  });

  it("retries a failed initial todo load before showing an error", async () => {
    jest.useFakeTimers();
    mockApi.getAllTodos
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ todos: [mockHabit] });

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(mockApi.getAllTodos).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(750);
    });

    await waitFor(() => {
      expect(getByText("Drink water")).toBeTruthy();
    });
  });

  it("shows a real error state when the initial todo load fails twice", async () => {
    jest.useFakeTimers();
    mockApi.getAllTodos.mockRejectedValue(new Error("Network error"));

    const { getByText, queryByText } = renderScreen();

    await waitFor(() => {
      expect(mockApi.getAllTodos).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(750);
    });

    await waitFor(() => {
      expect(getByText("Failed to load habits")).toBeTruthy();
    });
    expect(queryByText("No habits found")).toBeNull();
  });
});
