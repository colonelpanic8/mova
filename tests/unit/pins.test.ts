import AsyncStorage from "@react-native-async-storage/async-storage";

const mockNativeModules: { MovaPins?: unknown } = {};

jest.mock("react-native", () => ({
  NativeModules: mockNativeModules,
  DeviceEventEmitter: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  armPin,
  DEFAULT_PIN_PRESETS,
  getPinPresets,
  isPinsAvailable,
  listPins,
  setPinPresets,
  syncPresetsToWatch,
} from "../../services/pins";

function makeNative() {
  return {
    list: jest.fn().mockResolvedValue([]),
    arm: jest
      .fn()
      .mockImplementation(async (title: string, minutes: number) => ({
        id: "pin-1",
        title,
        createdAt: 1,
        escalateAt: minutes > 0 ? 2 : 0,
        escalated: false,
      })),
    complete: jest.fn().mockResolvedValue(undefined),
    snooze: jest.fn().mockResolvedValue(undefined),
    syncPresets: jest.fn().mockResolvedValue(undefined),
  };
}

describe("pins service", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockNativeModules.MovaPins = makeNative();
  });

  it("returns default presets when none are stored", async () => {
    expect(await getPinPresets()).toEqual(DEFAULT_PIN_PRESETS);
  });

  it("persists presets and syncs them to the watch", async () => {
    const presets = [{ title: "Stove", minutes: 10 }];
    await setPinPresets(presets);

    expect(await getPinPresets()).toEqual(presets);
    const native = mockNativeModules.MovaPins as ReturnType<typeof makeNative>;
    expect(native.syncPresets).toHaveBeenCalledWith(JSON.stringify(presets));
  });

  it("drops malformed stored presets", async () => {
    await AsyncStorage.setItem(
      "mova_pin_presets_v1",
      JSON.stringify([
        { title: "Valid", minutes: 5 },
        { title: 42, minutes: 5 },
        { minutes: 5 },
        "junk",
      ]),
    );

    expect(await getPinPresets()).toEqual([{ title: "Valid", minutes: 5 }]);
  });

  it("delegates arm to the native module", async () => {
    const pin = await armPin("Stove is on", 10);

    const native = mockNativeModules.MovaPins as ReturnType<typeof makeNative>;
    expect(native.arm).toHaveBeenCalledWith("Stove is on", 10);
    expect(pin?.title).toBe("Stove is on");
  });

  it("swallows watch sync failures", async () => {
    const native = mockNativeModules.MovaPins as ReturnType<typeof makeNative>;
    native.syncPresets.mockRejectedValue(new Error("no watch"));

    await expect(syncPresetsToWatch()).resolves.toBeUndefined();
  });

  describe("without the native module", () => {
    beforeEach(() => {
      delete mockNativeModules.MovaPins;
    });

    it("reports pins as unavailable and no-ops", async () => {
      expect(isPinsAvailable()).toBe(false);
      expect(await listPins()).toEqual([]);
      expect(await armPin("Stove", 5)).toBeNull();
      await expect(syncPresetsToWatch()).resolves.toBeUndefined();
    });
  });
});
