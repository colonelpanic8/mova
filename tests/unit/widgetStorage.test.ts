// Tests for the widget offline pending-todo queue (size cap + GC).
// widgets/storage.ts talks to a native SharedStorage module via react-native;
// mock both so the module runs in the Node unit environment.

const mockStore: Record<string, string> = {};

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

import {
  gcPendingTodos,
  getPendingTodos,
  MAX_PENDING_TODO_AGE_MS,
  MAX_PENDING_TODOS,
  PendingTodo,
  queuePendingTodo,
  savePendingTodos,
  STORAGE_KEYS,
} from "../../widgets/storage";

describe("widget pending-todo queue", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore?.();
  });

  describe("queuePendingTodo size cap", () => {
    it("keeps every entry while under the cap", async () => {
      for (let i = 0; i < 5; i++) {
        await queuePendingTodo(`todo ${i}`);
      }
      const todos = await getPendingTodos();
      expect(todos).toHaveLength(5);
      expect(todos.map((t) => t.text)).toEqual([
        "todo 0",
        "todo 1",
        "todo 2",
        "todo 3",
        "todo 4",
      ]);
    });

    it("caps the queue at MAX_PENDING_TODOS, dropping the oldest first", async () => {
      // Seed the queue at the cap with deterministic old timestamps.
      const seeded: PendingTodo[] = [];
      for (let i = 0; i < MAX_PENDING_TODOS; i++) {
        seeded.push({ text: `seed ${i}`, timestamp: i + 1, retryCount: 0 });
      }
      await savePendingTodos(seeded);

      // One more push must evict exactly the oldest entry ("seed 0").
      await queuePendingTodo("newest");

      const todos = await getPendingTodos();
      expect(todos).toHaveLength(MAX_PENDING_TODOS);
      expect(todos.some((t) => t.text === "seed 0")).toBe(false);
      expect(todos[0].text).toBe("seed 1");
      expect(todos[todos.length - 1].text).toBe("newest");
      expect(console.warn).toHaveBeenCalled();
    });

    it("drops multiple oldest entries when the queue is well over the cap", async () => {
      const seeded: PendingTodo[] = [];
      for (let i = 0; i < MAX_PENDING_TODOS + 10; i++) {
        seeded.push({ text: `seed ${i}`, timestamp: i + 1, retryCount: 0 });
      }
      await savePendingTodos(seeded);

      await queuePendingTodo("newest");

      const todos = await getPendingTodos();
      expect(todos).toHaveLength(MAX_PENDING_TODOS);
      // The 11 oldest (seed 0..10) are gone; newest is last.
      expect(todos[0].text).toBe("seed 11");
      expect(todos[todos.length - 1].text).toBe("newest");
    });
  });

  describe("gcPendingTodos", () => {
    it("removes entries older than the max age and keeps recent ones", async () => {
      const now = Date.now();
      const stale = now - MAX_PENDING_TODO_AGE_MS - 1000;
      const fresh = now - 1000;
      await savePendingTodos([
        { text: "old", timestamp: stale, retryCount: 7 },
        { text: "recent", timestamp: fresh, retryCount: 0 },
      ]);

      await gcPendingTodos();

      const todos = await getPendingTodos();
      expect(todos.map((t) => t.text)).toEqual(["recent"]);
      expect(console.warn).toHaveBeenCalled();
    });

    it("does not rewrite storage when nothing is stale", async () => {
      await savePendingTodos([
        { text: "recent", timestamp: Date.now(), retryCount: 0 },
      ]);
      const { NativeModules } = require("react-native");
      (NativeModules.SharedStorage.setItem as jest.Mock).mockClear();

      await gcPendingTodos();

      expect(NativeModules.SharedStorage.setItem).not.toHaveBeenCalledWith(
        STORAGE_KEYS.PENDING_TODOS,
        expect.anything(),
      );
      const todos = await getPendingTodos();
      expect(todos).toHaveLength(1);
    });
  });
});
