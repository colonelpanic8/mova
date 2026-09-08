import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { NativeModules } from "react-native";
import { MD3LightTheme, PaperProvider } from "react-native-paper";

import PinsScreen from "../../app/(tabs)/pins";
import { DEFAULT_PIN_PRESETS, Pin } from "../../services/pins";

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
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

const mockNative = {
  list: jest.fn(),
  arm: jest.fn(),
  complete: jest.fn(),
  snooze: jest.fn(),
  getDefaultReminderMinutes: jest.fn(),
  setDefaultReminderMinutes: jest.fn(),
  syncPresets: jest.fn().mockResolvedValue(undefined),
};

const renderScreen = () =>
  render(
    <PaperProvider theme={MD3LightTheme}>
      <PinsScreen />
    </PaperProvider>,
  );

describe("PinsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NativeModules as { MovaPins?: unknown }).MovaPins = mockNative;
    mockNative.list.mockResolvedValue([]);
    mockNative.arm.mockResolvedValue({
      id: "pin-1",
      title: "Stove is on",
      createdAt: Date.now(),
      escalateAt: 0,
      escalated: false,
    });
    mockNative.complete.mockResolvedValue(undefined);
    mockNative.snooze.mockResolvedValue(undefined);
    mockNative.getDefaultReminderMinutes.mockResolvedValue(15);
    mockNative.setDefaultReminderMinutes.mockResolvedValue(undefined);
    mockNative.syncPresets.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete (NativeModules as { MovaPins?: unknown }).MovaPins;
  });

  it("arms a pin when a preset chip is pressed", async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => getByTestId("presetChip-0"));
    fireEvent.press(getByTestId("presetChip-0"));

    await waitFor(() =>
      expect(mockNative.arm).toHaveBeenCalledWith(
        DEFAULT_PIN_PRESETS[0].title,
        DEFAULT_PIN_PRESETS[0].minutes,
      ),
    );
  });

  it("arms a custom pin from the text input", async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => getByTestId("customPinInput"));
    fireEvent.changeText(getByTestId("customPinInput"), "Package downstairs");
    fireEvent.changeText(getByTestId("customPinMinutes"), "20");
    fireEvent.press(getByTestId("customPinArm"));

    await waitFor(() =>
      expect(mockNative.arm).toHaveBeenCalledWith("Package downstairs", 20),
    );
  });

  it("uses the default reminder when no minutes are entered", async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => getByTestId("customPinInput"));
    fireEvent.changeText(getByTestId("customPinInput"), "Laundry in washer");
    fireEvent.press(getByTestId("customPinArm"));

    await waitFor(() =>
      expect(mockNative.arm).toHaveBeenCalledWith("Laundry in washer", -1),
    );
  });

  it("shows notification failures and keeps the custom pin draft", async () => {
    mockNative.arm.mockRejectedValueOnce(
      new Error("Enable pin notifications in Android Settings."),
    );
    const { getByTestId, getByText } = renderScreen();
    await waitFor(() => getByTestId("customPinInput"));
    fireEvent.changeText(getByTestId("customPinInput"), "Stove");
    fireEvent.changeText(getByTestId("customPinMinutes"), "10");
    fireEvent.press(getByTestId("customPinArm"));

    await waitFor(() =>
      getByText("Enable pin notifications in Android Settings."),
    );
    expect(getByTestId("customPinInput").props.value).toBe("Stove");
    expect(getByTestId("customPinMinutes").props.value).toBe("10");
  });

  it("quick-snoozes an active pin", async () => {
    const pin: Pin = {
      id: "pin-3",
      title: "Stove is on",
      createdAt: Date.now(),
      escalateAt: Date.now() + 60_000,
      escalated: false,
    };
    mockNative.list.mockResolvedValue([pin]);

    const { getByTestId, getByText } = renderScreen();

    await waitFor(() => getByTestId("pin-pin-3"));
    fireEvent.press(getByText("+30m"));

    await waitFor(() =>
      expect(mockNative.snooze).toHaveBeenCalledWith("pin-3", 30),
    );
  });

  it("completes an active pin", async () => {
    const pin: Pin = {
      id: "pin-9",
      title: "Scooter in lobby",
      createdAt: Date.now(),
      escalateAt: 0,
      escalated: false,
    };
    mockNative.list.mockResolvedValue([pin]);

    const { getByTestId, getByText } = renderScreen();

    await waitFor(() => getByTestId("pin-pin-9"));
    fireEvent.press(getByText("Done"));

    await waitFor(() =>
      expect(mockNative.complete).toHaveBeenCalledWith("pin-9"),
    );
  });
});
