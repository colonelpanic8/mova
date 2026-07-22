import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3LightTheme, PaperProvider } from "react-native-paper";

import CaptureScreen from "../../app/(tabs)/capture";
import { useApi } from "../../context/ApiContext";
import { useAuth } from "../../context/AuthContext";
import { useMutation } from "../../context/MutationContext";
import { useOutbox } from "../../context/OutboxContext";
import { useSettings } from "../../context/SettingsContext";
import { useTemplates } from "../../context/TemplatesContext";

jest.mock("../../context/ApiContext");
jest.mock("../../context/AuthContext");
jest.mock("../../context/MutationContext");
jest.mock("../../context/OutboxContext");
jest.mock("../../context/SettingsContext");
jest.mock("../../context/TemplatesContext");

jest.mock("../../components/KeyboardAwareContainer", () => ({
  KeyboardAwareContainer: ({
    children,
    style,
  }: {
    children: React.ReactNode;
    style?: object;
  }) => {
    const { View } = require("react-native");
    return <View style={style}>{children}</View>;
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
    const { View } = require("react-native");
    return <View testID={testID}>{children}</View>;
  },
}));

jest.mock("../../components/capture", () => ({
  CategoryField: () => null,
  PriorityPicker: () => null,
  PromptField: () => null,
  StatePicker: () => null,
}));

jest.mock("../../components/RepeaterPicker", () => ({
  RepeaterPicker: () => null,
}));

// Stub only the date field; TodoFormFields (and the real TagsEditor inside
// it) stay real so the tag-flush-on-submit behavior is exercised.
jest.mock("../../components/todoForm/DateFieldWithQuickActions", () => ({
  DateFieldWithQuickActions: () => null,
}));

const mockApi = {
  capture: jest.fn(),
};

const mockCaptureOrEnqueue = jest.fn();

const renderScreen = () =>
  render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={MD3LightTheme}>
        <CaptureScreen />
      </PaperProvider>
    </GestureHandlerRootView>,
  );

describe("CaptureScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockApi.capture.mockResolvedValue({ status: "created" });
    mockCaptureOrEnqueue.mockResolvedValue({
      outcome: "delivered",
      response: { status: "created" },
    });

    (useApi as jest.Mock).mockReturnValue(mockApi);
    (useAuth as jest.Mock).mockReturnValue({
      savedServers: [],
      activeServerId: null,
    });
    (useTemplates as jest.Mock).mockReturnValue({
      templates: {
        "quick-capture": {
          name: "Quick Capture",
          prompts: [],
        },
      },
      categoryTypes: [],
      filterOptions: null,
      isLoading: false,
      reloadTemplates: jest.fn(),
    });
    (useSettings as jest.Mock).mockReturnValue({
      quickScheduleIncludeTime: false,
    });
    (useMutation as jest.Mock).mockReturnValue({
      triggerRefresh: jest.fn(),
    });
    (useOutbox as jest.Mock).mockReturnValue({
      pendingCount: 0,
      enqueueCapture: jest.fn(),
      captureOrEnqueue: mockCaptureOrEnqueue,
      flushNow: jest.fn(),
      notice: null,
      clearNotice: jest.fn(),
    });
  });

  it("captures a typed tag even if add button is not pressed", async () => {
    const { getByPlaceholderText, getByTestId } = renderScreen();

    fireEvent.changeText(getByPlaceholderText("Tag name"), "work");
    fireEvent.press(getByTestId("captureButton"));

    await waitFor(() => {
      expect(mockCaptureOrEnqueue).toHaveBeenCalledWith({
        kind: "capture",
        templateKey: "quick-capture",
        values: { tags: ["work"] },
      });
    });
  });
});
