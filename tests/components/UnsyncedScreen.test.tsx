import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";
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

const mockOpenURL = jest.fn();
jest.mock("expo-linking", () => ({
  openURL: (url: string) => mockOpenURL(url),
}));

const shareSpy = jest
  .spyOn(Share, "share")
  .mockResolvedValue({ action: "sharedAction" as never });

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
    mockOutbox.flushNow.mockResolvedValue({
      attempted: 1,
      succeededCount: 1,
      rejections: [],
      haltedBy: null,
      remaining: 0,
    });
    mockOutbox.discardEntry.mockResolvedValue(undefined);
    shareSpy.mockResolvedValue({ action: "sharedAction" as never });
    mockOpenURL.mockResolvedValue(undefined);
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
    await waitFor(() => {
      expect(mockOutbox.discardEntry).toHaveBeenCalledWith("entry-1");
      expect(getByText("Capture discarded")).toBeTruthy();
    });
  });

  it("shares the capture through the share sheet", async () => {
    mockOutbox.pendingEntries = [entry];
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId("sharePendingCapture-entry-1"));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    expect(shareSpy.mock.calls[0][0].message).toContain("Stuck capture");
    expect(getByText("Share action finished")).toBeTruthy();
  });

  it("opens a prefilled GitHub issue and confirms the action", async () => {
    mockOutbox.pendingEntries = [entry];
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId("reportPendingCapture-entry-1"));

    await waitFor(() => expect(mockOpenURL).toHaveBeenCalledTimes(1));
    const url = new URL(mockOpenURL.mock.calls[0][0]);
    expect(url.pathname).toBe("/colonelpanic8/mova/issues/new");
    expect(url.searchParams.get("title")).toContain("Stuck capture");
    expect(getByText("GitHub issue opened")).toBeTruthy();
  });

  it("shows retry progress and the result", async () => {
    mockOutbox.pendingEntries = [entry];
    let finishRetry: ((value: unknown) => void) | undefined;
    mockOutbox.flushNow.mockReturnValue(
      new Promise((resolve) => {
        finishRetry = resolve;
      }),
    );
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId("unsyncedRetryAll"));
    expect(getByText("Retrying 1 capture…")).toBeTruthy();
    expect(getByTestId("unsyncedRetryAll")).toBeDisabled();

    finishRetry?.({
      attempted: 1,
      succeededCount: 0,
      rejections: [],
      haltedBy: entry,
      remaining: 1,
    });
    await waitFor(() =>
      expect(getByText("0 synced · 1 still queued")).toBeTruthy(),
    );
  });

  it("surfaces action failures", async () => {
    mockOutbox.pendingEntries = [entry];
    shareSpy.mockRejectedValueOnce(new Error("share failed"));
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId("sharePendingCapture-entry-1"));

    await waitFor(() =>
      expect(getByText("Could not open share sheet")).toBeTruthy(),
    );
  });

  it("surfaces retry failures", async () => {
    mockOutbox.pendingEntries = [entry];
    mockOutbox.flushNow.mockRejectedValueOnce(new Error("retry failed"));
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId("unsyncedRetryAll"));

    await waitFor(() =>
      expect(getByText("Could not retry captures")).toBeTruthy(),
    );
    expect(getByTestId("unsyncedRetryAll")).toBeEnabled();
  });

  it("does not discard when the dialog is cancelled", () => {
    mockOutbox.pendingEntries = [entry];
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId("discardPendingCapture-entry-1"));
    fireEvent.press(getByText("Cancel"));

    expect(mockOutbox.discardEntry).not.toHaveBeenCalled();
  });
});
