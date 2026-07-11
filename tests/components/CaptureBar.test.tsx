import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { MD3LightTheme, PaperProvider } from "react-native-paper";

import { CaptureBar } from "../../components/CaptureBar";
import { useApi } from "../../context/ApiContext";
import { useAuth } from "../../context/AuthContext";
import { useOutbox } from "../../context/OutboxContext";
import { useSettings } from "../../context/SettingsContext";
import { useTemplates } from "../../context/TemplatesContext";
import { ApiError } from "../../services/api";

jest.mock("../../context/ApiContext");
jest.mock("../../context/AuthContext");
jest.mock("../../context/OutboxContext");
jest.mock("../../context/SettingsContext");
jest.mock("../../context/TemplatesContext");

const mockApi = {
  capture: jest.fn(),
};

const mockOutbox = {
  pendingCount: 0,
  enqueueCapture: jest.fn(),
  captureOrEnqueue: jest.fn(),
  flushNow: jest.fn(),
  notice: null as string | null,
  clearNotice: jest.fn(),
};

const renderBar = () =>
  render(
    <PaperProvider theme={MD3LightTheme}>
      <CaptureBar />
    </PaperProvider>,
  );

describe("CaptureBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockApi.capture.mockResolvedValue({ status: "created" });
    mockOutbox.pendingCount = 0;
    mockOutbox.notice = null;
    mockOutbox.enqueueCapture.mockResolvedValue(undefined);
    mockOutbox.captureOrEnqueue.mockResolvedValue({
      outcome: "delivered",
      response: { status: "created" },
    });
    mockOutbox.flushNow.mockResolvedValue(undefined);

    (useApi as jest.Mock).mockReturnValue(mockApi);
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      activeServerId: "server-1",
    });
    (useOutbox as jest.Mock).mockImplementation(() => ({ ...mockOutbox }));
    (useSettings as jest.Mock).mockReturnValue({
      quickScheduleIncludeTime: false,
      setQuickScheduleIncludeTime: jest.fn(),
    });
    (useTemplates as jest.Mock).mockReturnValue({
      templates: {
        default: {
          name: "Todo",
          prompts: [{ name: "Title", type: "string", required: true }],
        },
      },
    });
  });

  it("shows the queued message and clears the input when the capture is queued", async () => {
    mockOutbox.captureOrEnqueue.mockResolvedValue({ outcome: "queued" });

    const { getByTestId, findByText } = renderBar();

    const input = getByTestId("captureBarInput");
    fireEvent.changeText(input, "buy milk");
    fireEvent.press(getByTestId("captureBarSend"));

    await waitFor(() => {
      expect(mockOutbox.captureOrEnqueue).toHaveBeenCalledWith({
        kind: "capture",
        templateKey: "default",
        values: { Title: "buy milk" },
      });
    });

    await findByText("Offline — capture saved, will retry");
    expect(input.props.value).toBe("");
  });

  it("preserves the input when captureOrEnqueue throws (permanent failure)", async () => {
    mockOutbox.captureOrEnqueue.mockRejectedValue(new ApiError(400));

    const { getByTestId, findByText } = renderBar();

    const input = getByTestId("captureBarInput");
    fireEvent.changeText(input, "buy milk");
    fireEvent.press(getByTestId("captureBarSend"));

    await findByText("Failed to capture");
    expect(input.props.value).toBe("buy milk");
  });

  it("shows the server's message when a delivered capture is refused", async () => {
    mockOutbox.captureOrEnqueue.mockResolvedValue({
      outcome: "delivered",
      response: { status: "error", message: "No such template" },
    });

    const { getByTestId, findByText } = renderBar();

    const input = getByTestId("captureBarInput");
    fireEvent.changeText(input, "buy milk");
    fireEvent.press(getByTestId("captureBarSend"));

    await findByText("No such template");
    expect(input.props.value).toBe("buy milk");
  });

  it("clears the input on a successful capture", async () => {
    const { getByTestId, findByText } = renderBar();

    const input = getByTestId("captureBarInput");
    fireEvent.changeText(input, "buy milk");
    fireEvent.press(getByTestId("captureBarSend"));

    await findByText("Captured!");
    expect(mockOutbox.captureOrEnqueue).toHaveBeenCalledWith({
      kind: "capture",
      templateKey: "default",
      values: { Title: "buy milk" },
    });
    expect(input.props.value).toBe("");
  });

  it("shows a pending chip that triggers a flush when pressed", async () => {
    mockOutbox.pendingCount = 3;

    const { getByTestId, queryByTestId } = renderBar();

    const chip = getByTestId("outboxPendingChip");
    fireEvent.press(chip);

    await waitFor(() => {
      expect(mockOutbox.flushNow).toHaveBeenCalled();
    });

    expect(queryByTestId("captureBarInput")).toBeTruthy();
  });

  it("hides the pending chip when nothing is queued", () => {
    const { queryByTestId } = renderBar();
    expect(queryByTestId("outboxPendingChip")).toBeNull();
  });

  it("persists the draft after typing and restores it on mount", async () => {
    const draftKey = "mova_capture_draft_v1:server-1";

    const first = renderBar();
    fireEvent.changeText(first.getByTestId("captureBarInput"), "half-typed");

    // Draft saves are debounced by ~500ms.
    await waitFor(
      async () => {
        expect(await AsyncStorage.getItem(draftKey)).toBe("half-typed");
      },
      { timeout: 2000 },
    );
    first.unmount();

    const second = renderBar();
    await waitFor(() => {
      expect(second.getByTestId("captureBarInput").props.value).toBe(
        "half-typed",
      );
    });

    await AsyncStorage.removeItem(draftKey);
  });
});
