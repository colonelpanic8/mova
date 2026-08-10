import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { DayPlannerView } from "../../components/DayPlannerView";
import { DateRelevance, Todo } from "../../services/api";

const mockEditingContext = {
  completingIds: new Set<string>(),
  updatingIds: new Set<string>(),
  deletingIds: new Set<string>(),
  registerSwipeable: jest.fn(),
  closeOtherSwipeables: jest.fn(),
  handleTodoPress: jest.fn(),
  scheduleTodo: jest.fn().mockResolvedValue(undefined),
  planTodoForDay: jest.fn().mockResolvedValue(undefined),
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

type PlannerTodo = Todo & { dateRelevance?: DateRelevance };

const todo = (updates: Partial<PlannerTodo>): PlannerTodo => ({
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps untimed items in a right-hand queue beside the timeline", () => {
    const { getByTestId, getByText } = render(
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
              dateRelevance: "overdue",
            }),
            todo({
              id: "habit",
              title: "Take vitamins",
              isWindowHabit: true,
              dateRelevance: "habit_required",
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
    expect(getByTestId("plannerTimelineItem-timed")).toBeTruthy();
    expect(getByText("Outline the proposal")).toBeTruthy();
    expect(getByTestId("plannerQueueItem-untimed")).toBeTruthy();
    expect(getByTestId("plannerQueueItem-overdue")).toBeTruthy();
    expect(getByTestId("plannerQueueItem-habit")).toBeTruthy();
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

  it("previews and confirms shifting every unfinished event after the cutoff", async () => {
    const { getByTestId, getByText } = render(
      <PaperProvider>
        <DayPlannerView
          date="2026-08-09"
          doneStates={["DONE"]}
          entries={[
            todo({
              id: "before-cutoff",
              title: "Morning task",
              scheduled: { date: "2026-08-09", time: "11:45" },
            }),
            todo({
              id: "after-cutoff",
              title: "Afternoon task",
              scheduled: { date: "2026-08-09", time: "13:00" },
            }),
            todo({
              id: "completed",
              title: "Completed task",
              todo: "DONE",
              scheduled: { date: "2026-08-09", time: "14:00" },
            }),
            todo({
              id: "habit",
              title: "Afternoon habit",
              isWindowHabit: true,
              scheduled: { date: "2026-08-09", time: "13:30" },
            }),
          ]}
        />
      </PaperProvider>,
    );

    fireEvent.press(getByTestId("plannerShiftButton"));

    expect(
      getByText(
        "2 unfinished events at or after 12:00 PM will move 15 min later.",
      ),
    ).toBeTruthy();
    expect(mockEditingContext.scheduleTodo).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("plannerShiftConfirmButton"));

    await waitFor(() =>
      expect(mockEditingContext.scheduleTodo).toHaveBeenCalledWith(
        expect.objectContaining({ id: "after-cutoff" }),
        { date: "2026-08-09", time: "13:15" },
      ),
    );
    expect(mockEditingContext.scheduleTodo).toHaveBeenCalledTimes(1);
    expect(mockEditingContext.planTodoForDay).toHaveBeenCalledWith(
      expect.objectContaining({ id: "habit" }),
      "2026-08-09",
      { hours: 13, minutes: 45 },
    );
  });

  it("derives an earlier shift from the selected target time", async () => {
    const { getByTestId, getByText, UNSAFE_getByType } = render(
      <PaperProvider>
        <DayPlannerView
          date="2026-08-09"
          entries={[
            todo({
              id: "afternoon",
              scheduled: { date: "2026-08-09", time: "13:00" },
            }),
          ]}
        />
      </PaperProvider>,
    );

    fireEvent.press(getByTestId("plannerShiftButton"));
    fireEvent.press(getByTestId("plannerShiftTargetButton"));
    fireEvent(
      UNSAFE_getByType("DateTimePicker" as never),
      "onChange",
      { type: "set" },
      new Date("2026-08-09T11:30:00"),
    );

    expect(
      getByText(
        "1 unfinished event at or after 12:00 PM will move 30 min earlier.",
      ),
    ).toBeTruthy();
    fireEvent.press(getByTestId("plannerShiftConfirmButton"));

    await waitFor(() =>
      expect(mockEditingContext.scheduleTodo).toHaveBeenCalledWith(
        expect.objectContaining({ id: "afternoon" }),
        { date: "2026-08-09", time: "12:30" },
      ),
    );
  });

  it("does not shift events when the confirmation is cancelled", () => {
    const { getByTestId, getByText } = render(
      <PaperProvider>
        <DayPlannerView
          date="2026-08-09"
          entries={[
            todo({
              id: "afternoon",
              scheduled: { date: "2026-08-09", time: "13:00" },
            }),
          ]}
        />
      </PaperProvider>,
    );

    fireEvent.press(getByTestId("plannerShiftButton"));
    fireEvent.press(getByText("Cancel"));

    expect(mockEditingContext.scheduleTodo).not.toHaveBeenCalled();
  });
});
