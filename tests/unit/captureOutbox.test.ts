import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "../../services/api";
import {
  CaptureClient,
  countOutbox,
  deliverOutboxRequest,
  enqueueOutboxEntry,
  flushOutbox,
  getOutboxEntryTitle,
  isRetryableCaptureError,
  listOutbox,
  OUTBOX_MAX_ENTRIES,
} from "../../services/captureOutbox";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Outboxes are scoped by server identity key (url::username), not server id.
const SCOPE = "https://one.example.com::alice";
const OTHER_SCOPE = "https://two.example.com::bob";

function captureRequest(title: string) {
  return {
    kind: "capture" as const,
    templateKey: "default",
    values: { Title: title },
  };
}

function makeClient(overrides: Partial<CaptureClient> = {}): CaptureClient {
  return {
    capture: jest.fn().mockResolvedValue({ status: "created" }),
    categoryCapture: jest.fn().mockResolvedValue({ status: "created" }),
    ...overrides,
  };
}

describe("captureOutbox", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe("enqueue / list", () => {
    it("enqueues entries and lists them oldest first", async () => {
      const first = await enqueueOutboxEntry(SCOPE, captureRequest("one"));
      const second = await enqueueOutboxEntry(SCOPE, captureRequest("two"));

      expect(first.droppedCount).toBe(0);
      expect(second.droppedCount).toBe(0);
      expect(first.count).toBe(1);
      expect(second.count).toBe(2);

      const entries = await listOutbox(SCOPE);
      expect(entries.map((e) => e.id)).toEqual([
        first.entry.id,
        second.entry.id,
      ]);
      expect(entries[0]).toMatchObject({
        request: captureRequest("one"),
        retryCount: 0,
        lastError: null,
      });
      expect(typeof entries[0].createdAt).toBe("string");
      expect(await countOutbox(SCOPE)).toBe(2);
    });

    it("keeps queues isolated per scope key", async () => {
      await enqueueOutboxEntry(SCOPE, captureRequest("one"));
      await enqueueOutboxEntry(OTHER_SCOPE, captureRequest("other"));

      expect(await countOutbox(SCOPE)).toBe(1);
      expect(await countOutbox(OTHER_SCOPE)).toBe(1);
      expect(getOutboxEntryTitle((await listOutbox(OTHER_SCOPE))[0])).toBe(
        "other",
      );
    });

    it("caps the queue and drops the oldest entries", async () => {
      for (let i = 0; i < OUTBOX_MAX_ENTRIES; i++) {
        await enqueueOutboxEntry(SCOPE, captureRequest(`entry-${i}`));
      }

      const result = await enqueueOutboxEntry(
        SCOPE,
        captureRequest("overflow"),
      );

      expect(result.droppedCount).toBe(1);
      expect(result.count).toBe(OUTBOX_MAX_ENTRIES);
      const entries = await listOutbox(SCOPE);
      expect(entries).toHaveLength(OUTBOX_MAX_ENTRIES);
      expect(getOutboxEntryTitle(entries[0])).toBe("entry-1");
      expect(getOutboxEntryTitle(entries[entries.length - 1])).toBe("overflow");
    });

    it("returns an empty list for corrupted storage", async () => {
      await AsyncStorage.setItem(
        `mova_capture_outbox_v1:${SCOPE}`,
        "not json {",
      );
      expect(await listOutbox(SCOPE)).toEqual([]);
    });

    it("filters out malformed entries", async () => {
      const { entry } = await enqueueOutboxEntry(SCOPE, captureRequest("ok"));
      await AsyncStorage.setItem(
        `mova_capture_outbox_v1:${SCOPE}`,
        JSON.stringify([entry, { junk: true }, null, "string"]),
      );

      const entries = await listOutbox(SCOPE);
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(entry.id);
    });
  });

  describe("deliverOutboxRequest", () => {
    it("dispatches template captures to capture", async () => {
      const client = makeClient();
      const response = await deliverOutboxRequest(
        client,
        captureRequest("one"),
      );

      expect(response).toEqual({ status: "created" });
      expect(client.capture).toHaveBeenCalledWith("default", { Title: "one" });
      expect(client.categoryCapture).not.toHaveBeenCalled();
    });

    it("dispatches category captures to categoryCapture", async () => {
      const client = makeClient();
      await deliverOutboxRequest(client, {
        kind: "category-capture",
        categoryType: "Project",
        category: "mova",
        values: { title: "three" },
      });

      expect(client.categoryCapture).toHaveBeenCalledWith("Project", "mova", {
        title: "three",
      });
      expect(client.capture).not.toHaveBeenCalled();
    });
  });

  describe("isRetryableCaptureError", () => {
    it("treats permanent 4xx ApiErrors as not retryable", () => {
      expect(isRetryableCaptureError(new ApiError(400))).toBe(false);
      expect(isRetryableCaptureError(new ApiError(401))).toBe(false);
      expect(isRetryableCaptureError(new ApiError(404))).toBe(false);
      expect(isRetryableCaptureError(new ApiError(422))).toBe(false);
    });

    it("treats transient HTTP statuses as retryable", () => {
      expect(isRetryableCaptureError(new ApiError(408))).toBe(true);
      expect(isRetryableCaptureError(new ApiError(429))).toBe(true);
      expect(isRetryableCaptureError(new ApiError(500))).toBe(true);
      expect(isRetryableCaptureError(new ApiError(503))).toBe(true);
    });

    it("treats network and timeout failures as retryable", () => {
      expect(
        isRetryableCaptureError(new TypeError("Network request failed")),
      ).toBe(true);
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      expect(isRetryableCaptureError(abortError)).toBe(true);
      expect(isRetryableCaptureError(new Error("Request timed out"))).toBe(
        true,
      );
    });
  });

  describe("flushOutbox", () => {
    it("delivers entries in order and empties the queue", async () => {
      await enqueueOutboxEntry(SCOPE, captureRequest("one"));
      await enqueueOutboxEntry(SCOPE, captureRequest("two"));
      await enqueueOutboxEntry(SCOPE, {
        kind: "category-capture",
        categoryType: "Project",
        category: "mova",
        values: { title: "three" },
      });

      const client = makeClient();
      const result = await flushOutbox(SCOPE, client);

      expect(result).toMatchObject({
        attempted: 3,
        succeededCount: 3,
        rejections: [],
        haltedBy: null,
        remaining: 0,
      });
      expect(client.capture).toHaveBeenNthCalledWith(1, "default", {
        Title: "one",
      });
      expect(client.capture).toHaveBeenNthCalledWith(2, "default", {
        Title: "two",
      });
      expect(client.categoryCapture).toHaveBeenCalledWith("Project", "mova", {
        title: "three",
      });
      expect(await countOutbox(SCOPE)).toBe(0);
    });

    it("halts on a retryable error, incrementing retryCount", async () => {
      await enqueueOutboxEntry(SCOPE, captureRequest("one"));
      const { entry: failing } = await enqueueOutboxEntry(
        SCOPE,
        captureRequest("two"),
      );
      await enqueueOutboxEntry(SCOPE, captureRequest("three"));

      const client = makeClient({
        capture: jest
          .fn()
          .mockResolvedValueOnce({ status: "created" })
          .mockRejectedValueOnce(new TypeError("Network request failed")),
      });

      const result = await flushOutbox(SCOPE, client);

      expect(client.capture).toHaveBeenCalledTimes(2);
      expect(result.succeededCount).toBe(1);
      expect(result.rejections).toEqual([]);
      expect(result.haltedBy?.id).toBe(failing.id);
      expect(result.remaining).toBe(2);

      const entries = await listOutbox(SCOPE);
      expect(entries.map(getOutboxEntryTitle)).toEqual(["two", "three"]);
      expect(entries[0].retryCount).toBe(1);
      expect(entries[0].lastError).toBe("Network request failed");
    });

    it("removes permanently rejected entries and keeps flushing", async () => {
      await enqueueOutboxEntry(SCOPE, captureRequest("bad"));
      await enqueueOutboxEntry(SCOPE, captureRequest("good"));

      const client = makeClient({
        capture: jest
          .fn()
          .mockRejectedValueOnce(new ApiError(400))
          .mockResolvedValueOnce({ status: "created" }),
      });

      const result = await flushOutbox(SCOPE, client);

      expect(result.succeededCount).toBe(1);
      expect(result.haltedBy).toBeNull();
      expect(result.remaining).toBe(0);
      expect(result.rejections).toHaveLength(1);
      expect(getOutboxEntryTitle(result.rejections[0].entry)).toBe("bad");
      expect(await countOutbox(SCOPE)).toBe(0);
    });

    it("treats a non-created response as a permanent rejection", async () => {
      await enqueueOutboxEntry(SCOPE, captureRequest("refused"));

      const client = makeClient({
        capture: jest
          .fn()
          .mockResolvedValue({ status: "error", message: "No such template" }),
      });

      const result = await flushOutbox(SCOPE, client);

      expect(result.succeededCount).toBe(0);
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].message).toBe("No such template");
      expect(await countOutbox(SCOPE)).toBe(0);
    });

    it("performs a single storage write per flush", async () => {
      await enqueueOutboxEntry(SCOPE, captureRequest("one"));
      await enqueueOutboxEntry(SCOPE, captureRequest("two"));
      await enqueueOutboxEntry(SCOPE, captureRequest("three"));

      const setItem = AsyncStorage.setItem as jest.Mock;
      const getItem = AsyncStorage.getItem as jest.Mock;
      setItem.mockClear();
      getItem.mockClear();

      await flushOutbox(SCOPE, makeClient());

      expect(getItem).toHaveBeenCalledTimes(1);
      expect(setItem).toHaveBeenCalledTimes(1);
      expect(await countOutbox(SCOPE)).toBe(0);
    });

    it("does not write at all when the queue is empty", async () => {
      const setItem = AsyncStorage.setItem as jest.Mock;
      setItem.mockClear();

      const result = await flushOutbox(SCOPE, makeClient());

      expect(result.attempted).toBe(0);
      expect(setItem).not.toHaveBeenCalled();
    });

    it("persists progress even when delivery throws unexpectedly mid-flush", async () => {
      await enqueueOutboxEntry(SCOPE, captureRequest("one"));
      await enqueueOutboxEntry(SCOPE, captureRequest("two"));

      // A retryable throw after the first success must still persist the
      // removal of "one" (single write in the finally path).
      const client = makeClient({
        capture: jest
          .fn()
          .mockResolvedValueOnce({ status: "created" })
          .mockRejectedValueOnce(new Error("boom")),
      });

      const result = await flushOutbox(SCOPE, client);
      expect(result.succeededCount).toBe(1);

      const entries = await listOutbox(SCOPE);
      expect(entries.map(getOutboxEntryTitle)).toEqual(["two"]);
    });
  });
});
