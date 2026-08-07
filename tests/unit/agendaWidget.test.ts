// Tests for the agenda widget's data layer. The module talks to a native
// SharedStorage module (credentials + render cache) and AsyncStorage
// (settings); mock both so it runs in the Node unit environment.

const mockStore: Record<string, string> = {};
const mockAsyncStore: Record<string, string> = {};

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
  NativeModules: {
    SharedStorage: {
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
  },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) =>
      key in mockAsyncStore ? mockAsyncStore[key] : null,
    ),
    setItem: jest.fn(async (key: string, value: string) => {
      mockAsyncStore[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete mockAsyncStore[key];
    }),
  },
}));

import { AgendaEntry, SingleDayAgendaResponse } from "../../services/api";
import {
  completeAgendaWidgetItem,
  loadAgendaWidgetData,
  MAX_AGENDA_WIDGET_ITEMS,
  readAgendaWidgetCache,
  selectAgendaWidgetItems,
} from "../../widgets/agendaWidgetData";

function entry(overrides: Partial<AgendaEntry> = {}): AgendaEntry {
  return {
    id: null,
    file: "/org/todo.org",
    pos: 100,
    title: "Something",
    todo: "TODO",
    tags: null,
    level: 1,
    scheduled: null,
    deadline: null,
    priority: null,
    olpath: null,
    notifyBefore: null,
    category: null,
    effectiveCategory: null,
    agendaLine: "",
    ...overrides,
  };
}

function dayResponse(entries: AgendaEntry[]): SingleDayAgendaResponse {
  return { span: "day", date: "2026-08-06", entries };
}

function seedCredentials() {
  mockStore.mova_api_url = "https://org.example.com";
  mockStore.mova_username = "ivan";
  mockStore.mova_password = "hunter2";
}

describe("selectAgendaWidgetItems", () => {
  it("keeps outstanding items and drops finished one-offs", () => {
    const items = selectAgendaWidgetItems(
      dayResponse([
        entry({ id: "a", title: "Outstanding" }),
        entry({ id: "b", title: "Finished", dateRelevance: "completed" }),
      ]),
    );

    expect(items.map((item) => item.title)).toEqual(["Outstanding"]);
  });

  it("drops entries whose raw keyword is a done state when the server doesn't classify entries", () => {
    const items = selectAgendaWidgetItems(
      dayResponse([
        entry({ id: "a", title: "Still open", todo: "TODO" }),
        entry({ id: "b", title: "Finished elsewhere", todo: "FINISHED" }),
      ]),
      { doneStates: ["DONE", "FINISHED"] },
    );

    expect(items.map((item) => item.title)).toEqual(["Still open"]);
  });

  it("drops entries that cannot be identified for completion", () => {
    const items = selectAgendaWidgetItems(
      dayResponse([
        entry({ id: null, file: null, pos: null, title: "Unlocatable" }),
        entry({
          id: null,
          file: "/org/todo.org",
          pos: 7,
          title: "By position",
        }),
      ]),
    );

    expect(items.map((item) => item.title)).toEqual(["By position"]);
  });

  it("falls back to the agenda line when an entry has no title", () => {
    const items = selectAgendaWidgetItems(
      dayResponse([
        entry({ id: "a", title: "", agendaLine: "Scheduled: Ship" }),
      ]),
    );

    expect(items[0].title).toBe("Scheduled: Ship");
  });

  it("hides habits unless they are shown in the agenda", () => {
    const response = dayResponse([
      entry({ id: "habit", title: "Stretch", isWindowHabit: true }),
      entry({ id: "todo", title: "Ship it" }),
    ]);

    expect(selectAgendaWidgetItems(response).map((i) => i.title)).toEqual([
      "Ship it",
    ]);
    // An outstanding habit is work due today, so it keeps its server position.
    expect(
      selectAgendaWidgetItems(response, { includeHabits: true }).map(
        (i) => i.title,
      ),
    ).toEqual(["Stretch", "Ship it"]);
  });

  it("keeps habits already logged today but sinks them to the bottom", () => {
    const items = selectAgendaWidgetItems(
      dayResponse([
        entry({
          id: "done-habit",
          title: "Logged habit",
          isWindowHabit: true,
          habitCompletedOnQueryDate: true,
        }),
        entry({ id: "todo", title: "Ship it" }),
      ]),
      { includeHabits: true },
    );

    expect(items.map((item) => item.title)).toEqual([
      "Ship it",
      "Logged habit",
    ]);
    expect(items[1].completedToday).toBe(true);
  });

  it("orders overdue first, then timed items by clock, then the rest", () => {
    const items = selectAgendaWidgetItems(
      dayResponse([
        entry({ id: "untimed", title: "Untimed" }),
        entry({
          id: "late",
          title: "Late meeting",
          scheduled: { date: "2026-08-06", time: "16:00" },
        }),
        entry({
          id: "early",
          title: "Standup",
          scheduled: { date: "2026-08-06", time: "09:00" },
        }),
        entry({
          id: "overdue",
          title: "Overdue thing",
          dateRelevance: "overdue",
        }),
      ]),
    );

    expect(items.map((item) => item.title)).toEqual([
      "Overdue thing",
      "Standup",
      "Late meeting",
      "Untimed",
    ]);
  });

  it("treats a past scheduled or deadline date as overdue when the server doesn't classify entries", () => {
    const items = selectAgendaWidgetItems(
      dayResponse([
        entry({
          id: "today",
          title: "Today",
          scheduled: { date: "2026-08-06" },
        }),
        entry({ id: "late", title: "Late", scheduled: { date: "2026-07-31" } }),
        entry({
          id: "due",
          title: "Past due",
          deadline: { date: "2026-08-01" },
        }),
      ]),
      { today: "2026-08-06" },
    );

    expect(items.map((item) => [item.title, item.isOverdue])).toEqual([
      ["Late", true],
      ["Past due", true],
      ["Today", false],
    ]);
  });

  it("does not second-guess a server that already classified the entry", () => {
    const items = selectAgendaWidgetItems(
      dayResponse([
        entry({
          id: "a",
          title: "Scheduled today, repeated from the past",
          scheduled: { date: "2026-07-01" },
          dateRelevance: "scheduled",
        }),
      ]),
      { today: "2026-08-06" },
    );

    expect(items[0].isOverdue).toBe(false);
  });

  it("labels an item with its deadline time when it has no scheduled time", () => {
    const items = selectAgendaWidgetItems(
      dayResponse([
        entry({
          id: "a",
          title: "Deadline only",
          deadline: { date: "2026-08-06", time: "17:30" },
        }),
      ]),
    );

    expect(items[0].timeLabel).toBe("17:30");
  });

  it("de-duplicates entries echoed across days and caps the list", () => {
    const items = selectAgendaWidgetItems({
      span: "custom",
      startDate: "2026-08-05",
      endDate: "2026-08-06",
      today: "2026-08-06",
      days: {
        "2026-08-05": [entry({ id: "dup", title: "Overdue" })],
        "2026-08-06": [
          entry({ id: "dup", title: "Overdue" }),
          ...Array.from({ length: MAX_AGENDA_WIDGET_ITEMS + 5 }, (_, i) =>
            entry({ id: `x${i}`, title: `Item ${i}` }),
          ),
        ],
      },
    });

    expect(items.filter((item) => item.id === "dup")).toHaveLength(1);
    expect(items).toHaveLength(MAX_AGENDA_WIDGET_ITEMS);
  });
});

describe("loadAgendaWidgetData", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) delete mockStore[key];
    for (const key of Object.keys(mockAsyncStore)) delete mockAsyncStore[key];
    jest.clearAllMocks();
  });

  it("reports unauthenticated when no credentials are stored", async () => {
    const data = await loadAgendaWidgetData();

    expect(data.status).toBe("unauthenticated");
    expect(data.items).toEqual([]);
  });

  it("fetches today's agenda including overdue items and caches it", async () => {
    seedCredentials();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      text: async () =>
        JSON.stringify(dayResponse([entry({ id: "a", title: "Ship it" })])),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const data = await loadAgendaWidgetData();

    expect(data.status).toBe("ok");
    expect(data.items.map((item) => item.title)).toEqual(["Ship it"]);
    expect(fetchMock.mock.calls[0][0]).toContain("include_overdue=true");
    await expect(readAgendaWidgetCache()).resolves.toMatchObject({
      items: [expect.objectContaining({ title: "Ship it" })],
    });
  });

  it("falls back to the cached agenda when the fetch fails", async () => {
    seedCredentials();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      text: async () =>
        JSON.stringify(dayResponse([entry({ id: "a", title: "Cached item" })])),
    }) as unknown as typeof fetch;
    await loadAgendaWidgetData();

    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const data = await loadAgendaWidgetData();

    expect(data.status).toBe("error");
    expect(data.items.map((item) => item.title)).toEqual(["Cached item"]);
  });
});

describe("completeAgendaWidgetItem", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) delete mockStore[key];
    for (const key of Object.keys(mockAsyncStore)) delete mockAsyncStore[key];
    jest.clearAllMocks();
  });

  it("posts the configured done state and drops the item from the cache", async () => {
    seedCredentials();
    mockAsyncStore.default_done_state = "FINISHED";
    mockStore.mova_agenda_widget_cache = JSON.stringify({
      status: "ok",
      fetchedAt: 1,
      items: [
        { key: "a", title: "Ship it" },
        { key: "b", title: "Other" },
      ],
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      text: async () =>
        JSON.stringify({ status: "completed", title: "Ship it" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await completeAgendaWidgetItem({
      key: "a",
      id: "a",
      title: "Ship it",
    });

    expect(result.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ id: "a", state: "FINISHED" });
    const cached = await readAgendaWidgetCache();
    expect(cached?.items.map((item) => item.key)).toEqual(["b"]);
  });

  it("identifies an item by file and position when it has no org id", async () => {
    seedCredentials();
    mockAsyncStore.default_done_state = "DONE";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      text: async () => JSON.stringify({ status: "completed" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await completeAgendaWidgetItem({
      key: "k",
      file: "/org/todo.org",
      pos: "412",
      title: "By position",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      file: "/org/todo.org",
      pos: 412,
      title: "By position",
    });
  });

  it("refuses a reference that carries no usable identifier", async () => {
    seedCredentials();
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await completeAgendaWidgetItem({ key: "k", title: "Ghost" });

    expect(result.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reports a failure instead of throwing when the request fails", async () => {
    seedCredentials();
    mockAsyncStore.default_done_state = "DONE";
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await completeAgendaWidgetItem({ key: "a", id: "a" });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/connection/i);
  });
});
