import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildAgendaCacheKey,
  buildAgendaViewKey,
  CachedAgendaData,
  clearCachedAgenda,
  getCachedAgenda,
  MAX_CACHED_AGENDA_VIEWS,
  pruneCachedAgendas,
  saveCachedAgenda,
} from "../../services/agendaCache";
import { buildConfigIdentityKey } from "../../services/configMetadata";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiRemove: jest.fn(),
}));

const SAMPLE_ENTRY: CachedAgendaData = {
  agenda: {
    span: "day",
    date: "2026-07-09",
    entries: [
      {
        id: "1",
        title: "Morning standup",
        todo: "TODO",
        tags: ["work"],
        level: 1,
        scheduled: { date: "2026-07-09", time: "09:00" },
        deadline: null,
        priority: null,
        file: "/test/work.org",
        pos: 100,
        olpath: null,
        notifyBefore: null,
        agendaLine: "Scheduled:  TODO Morning standup",
        category: null,
        effectiveCategory: null,
      },
    ],
  },
  multiDayData: null,
  todoStates: {
    active: ["TODO", "NEXT"],
    done: ["DONE"],
  },
  habitStatuses: null,
  fetchedAt: "2026-07-09T12:00:00.000Z",
};

const VIEW_KEY = buildAgendaViewKey({
  mode: "day",
  dateString: "2026-07-09",
  includeCompleted: false,
});

describe("agendaCache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
  });

  it("builds view keys that distinguish view mode, date, range, and completed", () => {
    expect(VIEW_KEY).toBe("day:2026-07-09:active");
    expect(
      buildAgendaViewKey({
        mode: "day",
        dateString: "2026-07-09",
        includeCompleted: true,
      }),
    ).toBe("day:2026-07-09:all");
    expect(
      buildAgendaViewKey({
        mode: "multiday",
        dateString: "2026-07-08",
        rangeLength: 7,
        includeCompleted: false,
      }),
    ).toBe("multiday:2026-07-08:7:active");
  });

  it("builds versioned storage keys per server identity and view", () => {
    const key = buildAgendaCacheKey("http://example.com/", "ivan", VIEW_KEY);
    expect(key).toContain("mova_agenda_cache_v1");
    // Same server with/without trailing slash normalizes to the same key
    expect(buildAgendaCacheKey("http://example.com", "ivan", VIEW_KEY)).toBe(
      key,
    );
    // Different user or view yields a different key
    expect(
      buildAgendaCacheKey("http://example.com", "other", VIEW_KEY),
    ).not.toBe(key);
    expect(
      buildAgendaCacheKey(
        "http://example.com",
        "ivan",
        "day:2026-07-10:active",
      ),
    ).not.toBe(key);
  });

  it("round-trips cached agenda data", async () => {
    await saveCachedAgenda(
      "http://example.com/",
      "ivan",
      VIEW_KEY,
      SAMPLE_ENTRY,
    );

    const [storedKey, storedValue] = (AsyncStorage.setItem as jest.Mock).mock
      .calls[0];
    expect(storedKey).toBe(
      buildAgendaCacheKey("http://example.com", "ivan", VIEW_KEY),
    );
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(storedValue);

    const cached = await getCachedAgenda(
      "http://example.com",
      "ivan",
      VIEW_KEY,
    );

    expect(cached).toEqual(SAMPLE_ENTRY);
  });

  it("returns null when nothing is stored", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      getCachedAgenda("http://example.com", "ivan", VIEW_KEY),
    ).resolves.toBeNull();
  });

  it("returns null for malformed JSON", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("{not json");

    await expect(
      getCachedAgenda("http://example.com", "ivan", VIEW_KEY),
    ).resolves.toBeNull();
  });

  it("returns null when the entry is missing required fields", async () => {
    // Missing fetchedAt
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ agenda: SAMPLE_ENTRY.agenda }),
    );
    await expect(
      getCachedAgenda("http://example.com", "ivan", VIEW_KEY),
    ).resolves.toBeNull();

    // Missing both agenda payloads
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ fetchedAt: "2026-07-09T12:00:00.000Z" }),
    );
    await expect(
      getCachedAgenda("http://example.com", "ivan", VIEW_KEY),
    ).resolves.toBeNull();
  });

  it("swallows storage errors on read and write", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error("storage unavailable"),
    );
    await expect(
      getCachedAgenda("http://example.com", "ivan", VIEW_KEY),
    ).resolves.toBeNull();

    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error("storage unavailable"),
    );
    await expect(
      saveCachedAgenda("http://example.com", "ivan", VIEW_KEY, SAMPLE_ENTRY),
    ).resolves.toBeUndefined();
  });

  it("composes storage keys from the shared config identity key", () => {
    expect(buildAgendaCacheKey("http://example.com/", "ivan", VIEW_KEY)).toBe(
      `mova_agenda_cache_v1:${buildConfigIdentityKey("http://example.com/", "ivan")}:${VIEW_KEY}`,
    );
  });

  it("preserves prior cached todoStates/habitStatuses when new values are null", async () => {
    const priorHabitStatuses = [
      { id: "habit-1", title: "Floss" },
    ] as unknown as CachedAgendaData["habitStatuses"];
    const prior: CachedAgendaData = {
      ...SAMPLE_ENTRY,
      todoStates: { active: ["TODO"], done: ["DONE", "CANCELLED"] },
      habitStatuses: priorHabitStatuses,
      fetchedAt: "2026-07-09T10:00:00.000Z",
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(prior),
    );

    // Agenda fetch succeeded but states/habits fetches failed (null).
    await saveCachedAgenda("http://example.com", "ivan", VIEW_KEY, {
      ...SAMPLE_ENTRY,
      todoStates: null,
      habitStatuses: null,
      fetchedAt: "2026-07-09T12:00:00.000Z",
    });

    const [, storedValue] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    const stored = JSON.parse(storedValue) as CachedAgendaData;
    expect(stored.todoStates).toEqual(prior.todoStates);
    expect(stored.habitStatuses).toEqual(priorHabitStatuses);
    // Fresh fields still win.
    expect(stored.agenda).toEqual(SAMPLE_ENTRY.agenda);
    expect(stored.fetchedAt).toBe("2026-07-09T12:00:00.000Z");
  });

  it("keeps fresh non-null todoStates/habitStatuses without reading the prior entry", async () => {
    const entry: CachedAgendaData = {
      ...SAMPLE_ENTRY,
      habitStatuses: [],
    };

    await saveCachedAgenda("http://example.com", "ivan", VIEW_KEY, entry);

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    const [, storedValue] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    expect(JSON.parse(storedValue)).toEqual(entry);
  });

  it("still saves the fresh entry when the prior-entry read fails", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error("storage unavailable"),
    );

    await saveCachedAgenda("http://example.com", "ivan", VIEW_KEY, {
      ...SAMPLE_ENTRY,
      habitStatuses: null,
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  describe("eviction", () => {
    const buildKeyForDay = (day: number) =>
      buildAgendaCacheKey(
        "http://example.com",
        "ivan",
        `day:2026-06-${String(day).padStart(2, "0")}:active`,
      );

    it("prunes the oldest entries beyond the per-identity limit", async () => {
      const total = MAX_CACHED_AGENDA_VIEWS + 2;
      const keys = Array.from({ length: total }, (_, i) =>
        buildKeyForDay(i + 1),
      );
      const foreignKeys = [
        "mova_metadata_cache_v1:http://example.com::ivan",
        buildAgendaCacheKey("http://other.com", "ivan", VIEW_KEY),
        buildAgendaCacheKey("http://example.com", "someoneelse", VIEW_KEY),
      ];
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        ...foreignKeys,
        ...keys,
      ]);
      // Older days have older fetchedAt timestamps.
      (AsyncStorage.multiGet as jest.Mock).mockImplementation(
        (requested: string[]) =>
          Promise.resolve(
            requested.map((key) => {
              const day = keys.indexOf(key) + 1;
              return [
                key,
                JSON.stringify({
                  ...SAMPLE_ENTRY,
                  fetchedAt: `2026-06-${String(day).padStart(2, "0")}T00:00:00.000Z`,
                }),
              ];
            }),
          ),
      );

      await pruneCachedAgendas("http://example.com", "ivan");

      // Only this identity's agenda-cache keys are considered.
      expect(AsyncStorage.multiGet).toHaveBeenCalledWith(keys);
      // The two oldest entries are removed; foreign keys are untouched.
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        buildKeyForDay(1),
        buildKeyForDay(2),
      ]);
    });

    it("does nothing when at or under the limit", async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(
        Array.from({ length: MAX_CACHED_AGENDA_VIEWS }, (_, i) =>
          buildKeyForDay(i + 1),
        ),
      );

      await pruneCachedAgendas("http://example.com", "ivan");

      expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
      expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
    });

    it("evicts unparseable entries first", async () => {
      const total = MAX_CACHED_AGENDA_VIEWS + 1;
      const keys = Array.from({ length: total }, (_, i) =>
        buildKeyForDay(i + 1),
      );
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(keys);
      (AsyncStorage.multiGet as jest.Mock).mockImplementation(
        (requested: string[]) =>
          Promise.resolve(
            requested.map((key) => {
              // The newest key is corrupt; everything else is valid.
              if (key === buildKeyForDay(total)) {
                return [key, "{not json"];
              }
              const day = keys.indexOf(key) + 1;
              return [
                key,
                JSON.stringify({
                  ...SAMPLE_ENTRY,
                  fetchedAt: `2026-06-${String(day).padStart(2, "0")}T00:00:00.000Z`,
                }),
              ];
            }),
          ),
      );

      await pruneCachedAgendas("http://example.com", "ivan");

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        buildKeyForDay(total),
      ]);
    });

    it("runs after each save and swallows pruning errors", async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(
        new Error("storage unavailable"),
      );

      await expect(
        saveCachedAgenda("http://example.com", "ivan", VIEW_KEY, SAMPLE_ENTRY),
      ).resolves.toBeUndefined();

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.getAllKeys).toHaveBeenCalled();
    });
  });

  it("clears cached entries and swallows removal errors", async () => {
    await clearCachedAgenda("http://example.com", "ivan", VIEW_KEY);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      buildAgendaCacheKey("http://example.com", "ivan", VIEW_KEY),
    );

    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
      new Error("storage unavailable"),
    );
    await expect(
      clearCachedAgenda("http://example.com", "ivan", VIEW_KEY),
    ).resolves.toBeUndefined();
  });
});
