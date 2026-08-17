import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { MD3LightTheme, PaperProvider } from "react-native-paper";

const mockOutbox = {
  pendingEntries: [] as unknown[],
  pendingCount: 0,
  flushNow: jest.fn(),
  discardEntry: jest.fn().mockResolvedValue(undefined),
};

jest.mock("../../context/OutboxContext", () => ({
  useOutbox: () => mockOutbox,
}));

import UnsyncedScreen from "../../app/(tabs)/settings/unsynced";

const entry = {
  id: "entry-1",
  createdAt: new Date().toISOString(),
  retryCount: 3,
  lastError: "Network request failed",
  request: {
    kind: "capture" as const,
    templateKey: "default",
    values: { Title: "Stuck capture" },
  },
};

const renderScreen = () =>
  render(
    <PaperProvider theme={MD3LightTheme}>
      <UnsyncedScreen />
    </PaperProvider>,
  );

describe("UnsyncedScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOutbox.pendingEntries = [];
  });

  it("shows an empty state when everything is synced", () => {
    const { getByText } = renderScreen();
    expect(getByText("Everything is synced")).toBeTruthy();
  });

  it("shows entry details including the last error", () => {
    mockOutbox.pendingEntries = [entry];
    const { getByText } = renderScreen();

    expect(getByText("Stuck capture")).toBeTruthy();
    expect(getByText(/3 attempts/)).toBeTruthy();
    expect(getByText(/Network request failed/)).toBeTruthy();
  });

  it("only discards after explicit confirmation", async () => {
    mockOutbox.pendingEntries = [entry];
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId("discardPendingCapture-entry-1"));
    expect(mockOutbox.discardEntry).not.toHaveBeenCalled();
    expect(getByText("Discard capture?")).toBeTruthy();

    fireEvent.press(getByTestId("confirmDiscardPendingCapture"));
    await waitFor(() =>
      expect(mockOutbox.discardEntry).toHaveBeenCalledWith("entry-1"),
    );
  });

  it("does not discard when the dialog is cancelled", () => {
    mockOutbox.pendingEntries = [entry];
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId("discardPendingCapture-entry-1"));
    fireEvent.press(getByText("Cancel"));

    expect(mockOutbox.discardEntry).not.toHaveBeenCalled();
  });
});
