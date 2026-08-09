import { act, renderHook } from "@testing-library/react-native";
import { useTodoMutations } from "../../hooks/useTodoMutations";
import { Todo } from "../../services/api";

const mockUpdateTodo = jest.fn();
const mockInvalidateServerData = jest.fn();
const mockShowSnackbar = jest.fn();

jest.mock("../../context/ApiContext", () => ({
  useApi: () => ({ updateTodo: mockUpdateTodo }),
}));

jest.mock("../../context/SettingsContext", () => ({
  useSettings: () => ({ useClientCompletionTime: false }),
}));

jest.mock("../../context/SnackbarContext", () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

jest.mock("../../hooks/queryKeys", () => ({
  useServerDataInvalidation: () => mockInvalidateServerData,
}));

const habit: Todo = {
  id: "habit-1",
  title: "Knee Pain PT",
  todo: "TODO",
  tags: null,
  level: 1,
  scheduled: { date: "2026-05-24" },
  deadline: { date: "2026-05-24" },
  priority: null,
  file: "/test/habits.org",
  pos: 10,
  olpath: null,
  notifyBefore: null,
  category: null,
  effectiveCategory: null,
  properties: { STYLE: "habit", ID: "habit-1" },
};

describe("useTodoMutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateTodo.mockResolvedValue({ status: "updated" });
  });

  it("plans a habit with metadata and leaves its real schedule unchanged", async () => {
    const onTodoUpdated = jest.fn();
    const { result } = renderHook(() => useTodoMutations({ onTodoUpdated }));

    await act(async () => {
      await result.current.planTodoForDay(habit, "2026-08-09", {
        hours: 23,
        minutes: 0,
      });
    });

    expect(mockUpdateTodo).toHaveBeenCalledWith(habit, {
      properties: { MOVA_PLANNED_AT: "2026-08-09T23:00" },
    });
    expect(mockUpdateTodo.mock.calls[0][1]).not.toHaveProperty("scheduled");
    expect(onTodoUpdated).toHaveBeenCalledWith(habit, {
      properties: {
        STYLE: "habit",
        ID: "habit-1",
        MOVA_PLANNED_AT: "2026-08-09T23:00",
      },
    });
  });
});
