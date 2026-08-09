import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { DayPlannerView } from "../../components/DayPlannerView";
import { Todo } from "../../services/api";

const mockEditingContext = {
  completingIds: new Set<string>(),
  updatingIds: new Set<string>(),
  deletingIds: new Set<string>(),
  registerSwipeable: jest.fn(),
  closeOtherSwipeables: jest.fn(),
  handleTodoPress: jest.fn(),
  scheduleTodo: jest.fn().mockResolvedValue(undefined),
  scheduleToday: jest.fn(),
  scheduleTomorrow: jest.fn(),
  openScheduleModal: jest.fn(),
  openDeadlineModal: jest.fn(),
  openPriorityModal: jest.fn(),
  openDeleteConfirm: jest.fn(),
  quickComplete: jest.fn(),
};

jest.mock("../../hooks/useTodoEditing", () => ({
  useTodoEditingContext: () => mockEditingContext,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../context/ColorPaletteContext", () => ({
  useColorPalette: () => ({
    getTodoStateColor: () => "#888888",
  }),
}));

const todo = (updates: Partial<Todo>): Todo => ({
  id: "todo-1",
  title: "Task",
  todo: "TODO",
  tags: null,
  level: 1,
  scheduled: null,
  deadline: null,
  priority: null,
  file: "/test/tasks.org",
  pos: 10,
  olpath: null,
  notifyBefore: null,
  category: null,
  effectiveCategory: null,
  ...updates,
});

describe("DayPlannerView", () => {
  it("keeps untimed items in a right-hand queue beside the timeline", () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <PaperProvider>
        <DayPlannerView
          date="2026-08-09"
          entries={[
            todo({
              id: "timed",
              title: "Morning standup",
              scheduled: { date: "2026-08-09", time: "09:00" },
            }),
            todo({
              id: "untimed",
              title: "Outline the proposal",
              scheduled: { date: "2026-08-09" },
            }),
            todo({
              id: "overdue",
              title: "Old overdue task",
              scheduled: { date: "2026-08-08" },
            }),
          ]}
        />
      </PaperProvider>,
    );

    expect(getByTestId("dayPlannerView")).toBeTruthy();
    expect(getByTestId("plannerTimeline")).toBeTruthy();
    expect(getByTestId("plannerQueue")).toBeTruthy();
    expect(getByText("Drag onto the timeline")).toBeTruthy();
    expect(getByText("Morning standup")).toBeTruthy();
    expect(getByText("Outline the proposal")).toBeTruthy();
    expect(getByTestId("plannerQueueItem-untimed")).toBeTruthy();
    expect(queryByTestId("plannerQueueItem-overdue")).toBeNull();
  });

  it("shows a clear empty queue state when every item has a time", () => {
    const { getByTestId, getByText } = render(
      <PaperProvider>
        <DayPlannerView
          date="2026-08-09"
          entries={[
            todo({
              id: "timed",
              scheduled: { date: "2026-08-09", time: "13:15" },
            }),
          ]}
        />
      </PaperProvider>,
    );

    expect(getByTestId("plannerQueueEmpty")).toBeTruthy();
    expect(getByText("Everything has a time")).toBeTruthy();
  });
});
