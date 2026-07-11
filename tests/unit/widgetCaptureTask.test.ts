// Tests for the widget capture flush classification: permanent 4xx rejections
// are dropped from the pending queue, transient failures are kept.
// widgets/QuickCaptureTask.ts -> widgets/storage.ts talk to a native
// SharedStorage module via react-native; mock it for the Node unit env, and
// mock global fetch to drive captureTodo without a real server.

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
  isPermanentRejection,
  widgetTaskHandler,
} from "../../widgets/QuickCaptureTask";
import {
  getPendingTodos,
  PendingTodo,
  savePendingTodos,
  STORAGE_KEYS,
} from "../../widgets/storage";

function setCredentials() {
  mockStore[STORAGE_KEYS.API_URL] = "https://example.test";
  mockStore[STORAGE_KEYS.USERNAME] = "user";
  mockStore[STORAGE_KEYS.PASSWORD] = "pass";
}

function mockFetchResponse(res: { ok: boolean; status: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = jest.fn(async () => res);
}

describe("isPermanentRejection", () => {
  it("classifies non-auth 4xx client rejections as permanent", () => {
    for (const status of [400, 402, 403, 404, 405, 422]) {
      expect(isPermanentRejection(status)).toBe(true);
    }
  });

  it("treats auth (401), timeout (408) and rate-limit (429) as non-permanent", () => {
    for (const status of [401, 408, 429]) {
      expect(isPermanentRejection(status)).toBe(false);
    }
  });

  it("treats 5xx, 2xx/3xx and missing status as non-permanent", () => {
    for (const status of [200, 302, 500, 502, 503, undefined]) {
      expect(isPermanentRejection(status)).toBe(false);
    }
  });
});

describe("processPendingTodos flush (via RETRY_PENDING)", () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    setCredentials();
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore?.();
    (console.log as jest.Mock).mockRestore?.();
    globalThis.fetch = origFetch;
    jest.useRealTimers();
  });

  it("drops a pending todo the server rejects with a permanent 4xx", async () => {
    const todo: PendingTodo = {
      text: "permanently bad todo",
      timestamp: Date.now(),
      retryCount: 0,
    };
    await savePendingTodos([todo]);
    mockFetchResponse({ ok: false, status: 422 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await widgetTaskHandler({ clickAction: "RETRY_PENDING" } as any);

    expect(await getPendingTodos()).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("permanently bad todo"),
    );
  });

  it("removes a pending todo the server accepts", async () => {
    const todo: PendingTodo = {
      text: "good todo",
      timestamp: Date.now(),
      retryCount: 0,
    };
    await savePendingTodos([todo]);
    mockFetchResponse({ ok: true, status: 200 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await widgetTaskHandler({ clickAction: "RETRY_PENDING" } as any);

    expect(await getPendingTodos()).toHaveLength(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("keeps a pending todo on a transient 5xx failure", async () => {
    const todo: PendingTodo = {
      text: "keep me",
      timestamp: Date.now(),
      retryCount: 0,
    };
    await savePendingTodos([todo]);
    // 500 is transient: submitTodoWithRetry exhausts its backoff loop and
    // reports failure without a permanent status, so the todo stays queued.
    mockFetchResponse({ ok: false, status: 500 });

    jest.useFakeTimers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pending = widgetTaskHandler({ clickAction: "RETRY_PENDING" } as any);
    // Drive the exponential-backoff sleeps to completion under fake timers.
    await jest.runAllTimersAsync();
    await pending;

    const remaining = await getPendingTodos();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].text).toBe("keep me");
    expect(console.warn).not.toHaveBeenCalled();
  });
});
