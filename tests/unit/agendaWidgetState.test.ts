const mockStore: Record<string, string> = {};

jest.mock("react-native", () => ({
  NativeModules: {
    SharedStorage: {
      getItem: jest.fn(async (key: string) => mockStore[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete mockStore[key];
      }),
    },
  },
}));

import {
  clearAgendaWidgetView,
  getAgendaWidgetView,
  setAgendaWidgetView,
} from "../../widgets/agendaWidgetState";

describe("agenda widget view state", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) delete mockStore[key];
  });

  it("remembers the selected tab independently for each widget", async () => {
    await setAgendaWidgetView(7, "habits");

    await expect(getAgendaWidgetView(7)).resolves.toBe("habits");
    await expect(getAgendaWidgetView(8)).resolves.toBe("agenda");

    await clearAgendaWidgetView(7);
    await expect(getAgendaWidgetView(7)).resolves.toBe("agenda");
  });
});
