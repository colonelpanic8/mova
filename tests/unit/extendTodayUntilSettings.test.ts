// The server's org-extend-today-until is the source of truth; the device value
// only fills in for servers that do not report one.
const mockStore: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) =>
      key in mockStore ? mockStore[key] : null,
    ),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete mockStore[key];
    }),
  },
}));

import {
  cacheServerExtendTodayUntilHour,
  getEffectiveExtendTodayUntilHour,
  getServerExtendTodayUntilHour,
  setExtendTodayUntilHour,
  subscribeToServerExtendTodayUntilHour,
} from "@/services/settings";

beforeEach(() => {
  for (const key of Object.keys(mockStore)) delete mockStore[key];
});

describe("extend-today-until resolution", () => {
  it("falls back to midnight when nothing is known", async () => {
    expect(await getEffectiveExtendTodayUntilHour()).toBe(0);
  });

  it("uses the device value while the server reports none", async () => {
    await setExtendTodayUntilHour(3);
    expect(await getServerExtendTodayUntilHour()).toBeNull();
    expect(await getEffectiveExtendTodayUntilHour()).toBe(3);
  });

  it("prefers the server value over the device value", async () => {
    await setExtendTodayUntilHour(3);
    await cacheServerExtendTodayUntilHour(5);
    expect(await getEffectiveExtendTodayUntilHour()).toBe(5);
  });

  it("honours a server value of 0 rather than falling back", async () => {
    await setExtendTodayUntilHour(3);
    await cacheServerExtendTodayUntilHour(0);
    expect(await getEffectiveExtendTodayUntilHour()).toBe(0);
  });

  it("drops the cached server value when the server stops reporting one", async () => {
    await cacheServerExtendTodayUntilHour(5);
    await cacheServerExtendTodayUntilHour(null);
    expect(await getServerExtendTodayUntilHour()).toBeNull();
  });

  it("notifies subscribers when the server value changes", async () => {
    const seen: (number | null)[] = [];
    const unsubscribe = subscribeToServerExtendTodayUntilHour((hour) =>
      seen.push(hour),
    );

    await cacheServerExtendTodayUntilHour(4);
    await cacheServerExtendTodayUntilHour(null);
    unsubscribe();
    await cacheServerExtendTodayUntilHour(2);

    expect(seen).toEqual([4, null]);
  });

  it("ignores out-of-range stored values", async () => {
    mockStore["mova_server_extend_today_until_hour"] = "42";
    expect(await getServerExtendTodayUntilHour()).toBeNull();
  });
});
