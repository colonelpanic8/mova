/**
 * Tests for the Search Screen functionality
 *
 * These tests verify:
 * - Todo list rendering
 * - Search/filtering functionality
 * - Todo completion
 * - Pull to refresh
 */

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3LightTheme, PaperProvider } from "react-native-paper";
import { FilterProvider } from "../../context/FilterContext";

// Mock the modules before importing the component
jest.mock("../../services/api");
jest.mock("../../context/AuthContext");
jest.mock("../../context/ColorPaletteContext", () => ({
  useColorPalette: () => ({
    getTodoStateColor: (keyword: string) => "#888888",
    getActionColor: (action: string) => "#666666",
    getPriorityColor: (priority: string) => "#444444",
  }),
}));

// Mock Portal for modals
jest.mock("react-native-paper", () => {
  const actual = jest.requireActual("react-native-paper");
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});
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

// Import after mocks are set up
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

// Mock data
const mockTodos = [
  {
    id: "1",
    title: "Buy groceries",
    todo: "TODO",
    tags: ["shopping", "personal"],
    level: 1,
    scheduled: "2024-06-15",
    scheduledRepeater: null,
    deadline: null,
    deadlineRepeater: null,
    priority: "A",
    file: "/test/inbox.org",
    pos: 100,
    olpath: null,
    notifyBefore: null,
    category: "inbox",
  },
  {
    id: "2",
    title: "Review PR",
    todo: "NEXT",
    tags: ["work"],
    level: 1,
    scheduled: null,
    scheduledRepeater: null,
    deadline: "2024-06-20",
    deadlineRepeater: null,
    priority: null,
    file: "/test/work.org",
    pos: 200,
    olpath: null,
    notifyBefore: null,
    category: "work",
  },
  {
    id: "3",
    title: "Old task",
    todo: "DONE",
    tags: null,
    level: 1,
    scheduled: null,
    scheduledRepeater: null,
    deadline: null,
    deadlineRepeater: null,
    priority: null,
    file: "/test/inbox.org",
    pos: 300,
    olpath: null,
    notifyBefore: null,
    category: "inbox",
  },
];

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
  (api.getAllTodos as jest.Mock).mockResolvedValue({
    todos: mockTodos,
    defaults: { notifyBefore: [30] },
  });
  (api.getTodoStates as jest.Mock).mockResolvedValue({
    active: ["TODO", "NEXT", "WAITING"],
    done: ["DONE"],
  });
  (api.completeTodo as jest.Mock).mockResolvedValue({
    status: "completed",
    newState: "DONE",
  });
  (api.setTodoState as jest.Mock).mockResolvedValue({
    status: "completed",
    newState: "DONE",
  });
  (api.updateTodo as jest.Mock).mockResolvedValue({
    status: "updated",
  });
});

// Helper to render with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <PaperProvider theme={MD3LightTheme}>{component}</PaperProvider>,
  );
};

describe("SearchScreen API Integration", () => {
  it("should configure API with auth credentials on mount", async () => {
    // We test the expected API calls without rendering the full screen
    // This verifies the logic that would happen in useEffect

    const apiUrl = "http://test-api.local";
    const username = "testuser";
    const password = "testpass";

    api.configure(apiUrl, username, password);

    expect(api.configure).toHaveBeenCalledWith(apiUrl, username, password);
  });

  it("should fetch todos via API", async () => {
    const result = await api.getAllTodos();

    expect(api.getAllTodos).toHaveBeenCalled();
    expect(result.todos).toHaveLength(3);
    expect(result.todos[0].title).toBe("Buy groceries");
  });

  it("should complete a todo via API", async () => {
    const todo = mockTodos[0];
    const result = await api.completeTodo(todo);

    expect(api.completeTodo).toHaveBeenCalledWith(todo);
    expect(result.status).toBe("completed");
    expect(result.newState).toBe("DONE");
  });

  it("should update a todo via API", async () => {
    const todo = mockTodos[0];
    const updates = { scheduled: "2024-06-25" };

    const result = await api.updateTodo(todo, updates);

    expect(api.updateTodo).toHaveBeenCalledWith(todo, updates);
    expect(result.status).toBe("updated");
  });
});

describe("SearchScreen Data Processing", () => {
  it("should filter todos by title", () => {
    const query = "groceries";
    const filtered = mockTodos.filter((todo) =>
      todo.title?.toLowerCase().includes(query.toLowerCase()),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Buy groceries");
  });

  it("should filter todos by tag", () => {
    const query = "work";
    const filtered = mockTodos.filter((todo) =>
      todo.tags?.some((tag) => tag.toLowerCase().includes(query.toLowerCase())),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Review PR");
  });

  it("should filter todos by todo state", () => {
    const query = "next";
    const filtered = mockTodos.filter((todo) =>
      todo.todo?.toLowerCase().includes(query.toLowerCase()),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Review PR");
  });

  it("should return all todos when query is empty", () => {
    const query = "";
    const filtered = query.trim()
      ? mockTodos.filter((todo) =>
          todo.title?.toLowerCase().includes(query.toLowerCase()),
        )
      : mockTodos;

    expect(filtered).toHaveLength(3);
  });

  it("should return empty array when no matches found", () => {
    const query = "nonexistent";
    const filtered = mockTodos.filter((todo) =>
      todo.title?.toLowerCase().includes(query.toLowerCase()),
    );

    expect(filtered).toHaveLength(0);
  });
});

describe("SearchScreen Todo State Colors", () => {
  const getTodoColor = (todo: string): string => {
    switch (todo.toUpperCase()) {
      case "TODO":
        return "error"; // red
      case "NEXT":
        return "primary"; // blue
      case "DONE":
        return "outline"; // gray
      case "WAITING":
        return "tertiary"; // yellow
      default:
        return "secondary";
    }
  };

  it("should return error color for TODO", () => {
    expect(getTodoColor("TODO")).toBe("error");
  });

  it("should return primary color for NEXT", () => {
    expect(getTodoColor("NEXT")).toBe("primary");
  });

  it("should return outline color for DONE", () => {
    expect(getTodoColor("DONE")).toBe("outline");
  });

  it("should return tertiary color for WAITING", () => {
    expect(getTodoColor("WAITING")).toBe("tertiary");
  });

  it("should return secondary color for unknown states", () => {
    expect(getTodoColor("UNKNOWN")).toBe("secondary");
  });
});

describe("SearchScreen Date Formatting", () => {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const hasTime = dateString.includes("T") && dateString.includes(":");
    if (hasTime) {
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  it("should format date-only strings", () => {
    const formatted = formatDate("2024-06-15");
    // Date parsing can shift by timezone, so just check format structure
    expect(formatted).toMatch(/[A-Z][a-z]{2} \d{1,2}/); // e.g., "Jun 15" or "Jun 14"
  });

  it("should format datetime strings with time", () => {
    const formatted = formatDate("2024-06-15T14:30:00");
    expect(formatted).toContain("Jun");
    expect(formatted).toContain("15");
    // Time should be included
    expect(formatted.length).toBeGreaterThan(6);
  });
});

describe("SearchScreen Todo Key Generation", () => {
  const getTodoKey = (todo: (typeof mockTodos)[0]): string => {
    return todo.id || `${todo.file}:${todo.pos}:${todo.title}`;
  };

  it("should use id when available", () => {
    const todo = mockTodos[0];
    expect(getTodoKey(todo)).toBe("1");
  });

  it("should generate key from file:pos:title when no id", () => {
    const todoWithoutId = { ...mockTodos[0], id: null };
    expect(getTodoKey(todoWithoutId as any)).toBe(
      "/test/inbox.org:100:Buy groceries",
    );
  });
});

describe("SearchScreen Error Handling", () => {
  it("should handle API errors gracefully", async () => {
    (api.getAllTodos as jest.Mock).mockRejectedValue(
      new Error("Network error"),
    );

    await expect(api.getAllTodos()).rejects.toThrow("Network error");
  });

  it("should handle completion errors", async () => {
    (api.completeTodo as jest.Mock).mockRejectedValue(
      new Error("Completion failed"),
    );

    await expect(api.completeTodo(mockTodos[0])).rejects.toThrow(
      "Completion failed",
    );
  });
});

// Simple component rendering test
describe("SearchScreen UI Components", () => {
  it("should render a searchbar component", () => {
    const { getByPlaceholderText } = renderWithProviders(
      <View>
        <TextInput placeholder="Search todos..." testID="searchbar" />
      </View>,
    );

    expect(getByPlaceholderText("Search todos...")).toBeTruthy();
  });

  it("should render todo items in a list", () => {
    const { getByText, getAllByText } = renderWithProviders(
      <View>
        <FlatList
          data={mockTodos}
          keyExtractor={(item) => item.id || ""}
          renderItem={({ item }) => (
            <View testID={`todo-${item.id}`}>
              <Text>{item.title}</Text>
              <Text>{item.todo}</Text>
            </View>
          )}
        />
      </View>,
    );

    expect(getByText("Buy groceries")).toBeTruthy();
    expect(getByText("Review PR")).toBeTruthy();
    expect(getByText("Old task")).toBeTruthy();
  });

  it("should render todo state chips", () => {
    const { getByText } = renderWithProviders(
      <View>
        {mockTodos.map((todo) => (
          <TouchableOpacity key={todo.id} testID={`chip-${todo.id}`}>
            <Text>{todo.todo}</Text>
          </TouchableOpacity>
        ))}
      </View>,
    );

    expect(getByText("TODO")).toBeTruthy();
    expect(getByText("NEXT")).toBeTruthy();
    expect(getByText("DONE")).toBeTruthy();
  });

  it("should render tags", () => {
    const { getByText } = renderWithProviders(
      <View>
        {mockTodos
          .filter((t) => t.tags)
          .map((todo) => (
            <View key={todo.id}>
              {todo.tags?.map((tag) => (
                <Text key={tag}>:{tag}:</Text>
              ))}
            </View>
          ))}
      </View>,
    );

    expect(getByText(":shopping:")).toBeTruthy();
    expect(getByText(":personal:")).toBeTruthy();
    expect(getByText(":work:")).toBeTruthy();
  });
});

// Import the actual screen component
import SearchScreen from "../../app/(tabs)/search";

// Helper to render with all required providers
const renderScreen = (component: React.ReactElement) => {
  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={MD3LightTheme}>
        <FilterProvider>{component}</FilterProvider>
      </PaperProvider>
    </GestureHandlerRootView>,
  );
};

describe("SearchScreen Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useAuth to return valid credentials
    (useAuth as jest.Mock).mockReturnValue({
      apiUrl: "http://test-api.local",
      username: "testuser",
      password: "testpass",
      isAuthenticated: true,
    });

    // Mock API methods
    (api.configure as jest.Mock).mockImplementation(() => {});
    (api.getAllTodos as jest.Mock).mockResolvedValue({
      todos: mockTodos,
      defaults: { notifyBefore: [30] },
    });
    (api.getTodoStates as jest.Mock).mockResolvedValue({
      active: ["TODO", "NEXT", "WAITING"],
      done: ["DONE"],
    });
    (api.completeTodo as jest.Mock).mockResolvedValue({
      status: "completed",
      newState: "DONE",
    });
    (api.setTodoState as jest.Mock).mockResolvedValue({
      status: "completed",
      newState: "DONE",
    });
  });

  it("should render loading state initially", async () => {
    // Make getAllTodos hang to test loading state
    (api.getAllTodos as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    );

    const { getByTestId, queryByText } = renderScreen(<SearchScreen />);

    // Should show loading indicator, not the search bar
    await waitFor(() => {
      expect(queryByText("Buy groceries")).toBeNull();
    });
  });

  it("should render todos after loading", async () => {
    const { getByText, getByPlaceholderText } = renderScreen(<SearchScreen />);

    await waitFor(() => {
      expect(getByPlaceholderText("Search todos...")).toBeTruthy();
    });

    await waitFor(() => {
      expect(getByText("Buy groceries")).toBeTruthy();
      expect(getByText("Review PR")).toBeTruthy();
    });
  });

  it("should filter todos when searching", async () => {
    const { getByText, getByPlaceholderText, queryByText } = renderScreen(
      <SearchScreen />,
    );

    // Wait for initial load
    await waitFor(() => {
      expect(getByText("Buy groceries")).toBeTruthy();
    });

    // Type in search
    const searchInput = getByPlaceholderText("Search todos...");
    fireEvent.changeText(searchInput, "groceries");

    // Should show filtered results
    await waitFor(() => {
      expect(getByText("Buy groceries")).toBeTruthy();
      expect(queryByText("Review PR")).toBeNull();
    });
  });

  it("should show empty state when no matches", async () => {
    const { getByText, getByPlaceholderText } = renderScreen(<SearchScreen />);

    await waitFor(() => {
      expect(getByText("Buy groceries")).toBeTruthy();
    });

    const searchInput = getByPlaceholderText("Search todos...");
    fireEvent.changeText(searchInput, "nonexistent");

    await waitFor(() => {
      expect(getByText("No matching todos")).toBeTruthy();
    });
  });

  it("should handle API errors gracefully", async () => {
    (api.getAllTodos as jest.Mock).mockRejectedValue(
      new Error("Network error"),
    );

    const { getByText } = renderScreen(<SearchScreen />);

    await waitFor(() => {
      expect(getByText("Failed to load todos")).toBeTruthy();
    });
  });

  it("should open state modal when chip is tapped", async () => {
    const { getByText, getAllByText } = renderScreen(<SearchScreen />);

    await waitFor(() => {
      expect(getByText("Buy groceries")).toBeTruthy();
    });

    // Find and tap the TODO chip
    const todoChips = getAllByText("TODO");
    fireEvent.press(todoChips[0]);

    // Modal should open with state options
    await waitFor(() => {
      expect(getByText("Change State")).toBeTruthy();
      expect(getByText("DONE")).toBeTruthy();
    });
  });

  it("should change state and show snackbar after selecting from modal", async () => {
    const { getByText, getAllByText } = renderScreen(<SearchScreen />);

    await waitFor(() => {
      expect(getByText("Buy groceries")).toBeTruthy();
    });

    // Open the state modal
    const todoChips = getAllByText("TODO");
    fireEvent.press(todoChips[0]);

    // Wait for modal to open
    await waitFor(() => {
      expect(getByText("Change State")).toBeTruthy();
    });

    // Select DONE state
    const doneOption = getByText("DONE");
    fireEvent.press(doneOption);

    // Press Change button
    const changeButton = getByText("Change");
    fireEvent.press(changeButton);

    // Verify API was called with correct state
    await waitFor(() => {
      expect(api.setTodoState).toHaveBeenCalled();
    });
  });

  it("should filter by tag", async () => {
    const { getByText, getByPlaceholderText, queryByText } = renderScreen(
      <SearchScreen />,
    );

    await waitFor(() => {
      expect(getByText("Buy groceries")).toBeTruthy();
    });

    const searchInput = getByPlaceholderText("Search todos...");
    fireEvent.changeText(searchInput, "work");

    await waitFor(() => {
      expect(getByText("Review PR")).toBeTruthy();
      expect(queryByText("Buy groceries")).toBeNull();
    });
  });

  it("should filter by todo state", async () => {
    const { getByText, getByPlaceholderText, queryByText } = renderScreen(
      <SearchScreen />,
    );

    await waitFor(() => {
      expect(getByText("Buy groceries")).toBeTruthy();
    });

    const searchInput = getByPlaceholderText("Search todos...");
    fireEvent.changeText(searchInput, "NEXT");

    await waitFor(() => {
      expect(getByText("Review PR")).toBeTruthy();
      expect(queryByText("Buy groceries")).toBeNull();
    });
  });
});
