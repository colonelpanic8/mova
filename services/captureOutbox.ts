import type { Repeater, Timestamp } from "@/services/api";
import { ApiError, isRetryableStatus } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "mova_capture_outbox_v1";

/**
 * Maximum number of entries retained per scope. When the cap is exceeded the
 * oldest entries are dropped; callers are informed via the returned
 * droppedCount so the loss is never silent.
 */
export const OUTBOX_MAX_ENTRIES = 100;

export type CaptureRequestValues = Record<
  string,
  string | string[] | Repeater | Timestamp
>;

export type CategoryCaptureRequestValues = Record<
  string,
  string | string[] | Timestamp
>;

export type OutboxRequest =
  | {
      kind: "capture";
      templateKey: string;
      values: CaptureRequestValues;
    }
  | {
      kind: "category-capture";
      categoryType: string;
      category: string;
      values: CategoryCaptureRequestValues;
    };

export interface OutboxEntry {
  id: string;
  createdAt: string;
  request: OutboxRequest;
  retryCount: number;
  lastError: string | null;
}

/** Shape of the server's response to either capture endpoint. */
export interface CaptureDeliveryResponse {
  status: string;
  message?: string;
}

/**
 * Minimal structural view of the api client needed to deliver captures.
 * OrgAgendaApi satisfies this; tests can pass a simple mock.
 */
export interface CaptureClient {
  capture(
    template: string,
    values: CaptureRequestValues,
  ): Promise<CaptureDeliveryResponse>;
  categoryCapture(
    type: string,
    category: string,
    values: CategoryCaptureRequestValues,
  ): Promise<CaptureDeliveryResponse>;
}

/**
 * Outboxes are scoped by server identity (`buildConfigIdentityKey(apiUrl,
 * username)` from services/configMetadata.ts), not by saved-server id, so
 * they work even when no SavedServer entry exists (legacy single-server
 * installs, Detox test logins).
 */
function buildOutboxStorageKey(scopeKey: string): string {
  return `${STORAGE_PREFIX}:${scopeKey}`;
}

function generateEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidRequest(value: unknown): value is OutboxRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<OutboxRequest>;
  if (!request.values || typeof request.values !== "object") return false;
  if (request.kind === "capture") {
    return typeof request.templateKey === "string";
  }
  if (request.kind === "category-capture") {
    return (
      typeof request.categoryType === "string" &&
      typeof request.category === "string"
    );
  }
  return false;
}

function isValidEntry(value: unknown): value is OutboxEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<OutboxEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.retryCount === "number" &&
    isValidRequest(entry.request)
  );
}

/**
 * List the queued captures for a scope, oldest first. Malformed storage
 * contents are ignored rather than crashing (defensive, like configMetadata).
 */
export async function listOutbox(scopeKey: string): Promise<OutboxEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(buildOutboxStorageKey(scopeKey));
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidEntry);
  } catch (error) {
    console.warn("Failed to read capture outbox:", error);
    return [];
  }
}

async function writeOutbox(
  scopeKey: string,
  entries: OutboxEntry[],
): Promise<void> {
  await AsyncStorage.setItem(
    buildOutboxStorageKey(scopeKey),
    JSON.stringify(entries),
  );
}

export interface EnqueueResult {
  entry: OutboxEntry;
  /** Number of oldest entries dropped because the queue was over capacity. */
  droppedCount: number;
  /** Number of entries queued after this enqueue. */
  count: number;
}

/**
 * Persist a capture for later delivery. Unlike the other helpers this lets
 * storage errors propagate: if the entry cannot be persisted the caller must
 * know, so it can fall back to keeping the user's input on screen.
 */
export async function enqueueOutboxEntry(
  scopeKey: string,
  request: OutboxRequest,
): Promise<EnqueueResult> {
  const entries = await listOutbox(scopeKey);
  const entry: OutboxEntry = {
    id: generateEntryId(),
    createdAt: new Date().toISOString(),
    request,
    retryCount: 0,
    lastError: null,
  };
  entries.push(entry);

  let droppedCount = 0;
  while (entries.length > OUTBOX_MAX_ENTRIES) {
    entries.shift();
    droppedCount += 1;
  }
  if (droppedCount > 0) {
    console.warn(
      `Capture outbox full: dropped ${droppedCount} oldest queued capture(s)`,
    );
  }

  await writeOutbox(scopeKey, entries);
  return { entry, droppedCount, count: entries.length };
}

export async function countOutbox(scopeKey: string): Promise<number> {
  return (await listOutbox(scopeKey)).length;
}

/** Best-effort human-readable title for an entry, for user-facing messages. */
export function getOutboxEntryTitle(entry: OutboxEntry): string {
  const values = entry.request.values;
  for (const key of ["title", "Title", "name", "Name"]) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  for (const value of Object.values(values)) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return entry.request.kind === "capture"
    ? entry.request.templateKey
    : entry.request.categoryType;
}

/**
 * Deliver an outbox request through the api client, dispatching on its kind.
 * Shared by the live capture path (via OutboxContext.captureOrEnqueue) and
 * the queued path (flushOutbox) so the two can never disagree.
 */
export function deliverOutboxRequest(
  api: CaptureClient,
  request: OutboxRequest,
): Promise<CaptureDeliveryResponse> {
  return request.kind === "capture"
    ? api.capture(request.templateKey, request.values)
    : api.categoryCapture(
        request.categoryType,
        request.category,
        request.values,
      );
}

/**
 * True when a failed capture is worth retrying later (server unreachable,
 * timeout, or transient HTTP status). False for HTTP 4xx responses (other
 * than 408/429): the server saw the request and rejected it, so retrying
 * the same payload will not succeed.
 *
 * Non-HTTP failures (AbortError from timeouts, TypeError from fetch network
 * failures, or anything else unexpected) are treated as retryable so a
 * capture is never lost by misclassification.
 */
export function isRetryableCaptureError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return isRetryableStatus(error.status);
  }
  return true;
}

export interface OutboxRejection {
  entry: OutboxEntry;
  message: string;
}

export interface FlushOutboxResult {
  /** Number of entries that existed when the flush started. */
  attempted: number;
  /** Entries successfully delivered (and removed from the queue). */
  succeededCount: number;
  /**
   * Entries permanently rejected by the server (HTTP 4xx or a non-"created"
   * response). They are removed from the queue; callers must surface them to
   * the user so nothing vanishes silently.
   */
  rejections: OutboxRejection[];
  /**
   * The entry that hit a retryable error, halting the flush (server likely
   * unreachable). Null when the flush ran to completion.
   */
  haltedBy: OutboxEntry | null;
  /** Entries still queued after the flush. */
  remaining: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Attempt to deliver queued captures in order. Stops at the first retryable
 * failure (incrementing that entry's retryCount); permanently rejected
 * entries are removed and reported so the caller can notify the user.
 *
 * Storage is read once at the start and written once at the end (also on an
 * unexpected mid-flush throw, via finally), so a flush costs O(1) storage
 * operations instead of O(N).
 */
export async function flushOutbox(
  scopeKey: string,
  api: CaptureClient,
): Promise<FlushOutboxResult> {
  const entries = await listOutbox(scopeKey);
  let succeededCount = 0;
  const rejections: OutboxRejection[] = [];
  let haltedBy: OutboxEntry | null = null;

  if (entries.length === 0) {
    return {
      attempted: 0,
      succeededCount: 0,
      rejections: [],
      haltedBy: null,
      remaining: 0,
    };
  }

  // Entries still queued; delivered/rejected entries are removed from the
  // front as we go, and the halting entry is replaced with its updated copy.
  const remainingEntries = [...entries];

  try {
    while (remainingEntries.length > 0) {
      const entry = remainingEntries[0];
      try {
        const result = await deliverOutboxRequest(api, entry.request);

        if (result.status === "created") {
          succeededCount += 1;
        } else {
          // The server processed the request but refused it — retrying the
          // same payload will not help, so drop it and report it.
          rejections.push({
            entry,
            message:
              result.message ||
              `Server rejected capture (status ${result.status})`,
          });
        }
        remainingEntries.shift();
      } catch (error) {
        if (isRetryableCaptureError(error)) {
          remainingEntries[0] = {
            ...entry,
            retryCount: entry.retryCount + 1,
            lastError: errorMessage(error),
          };
          haltedBy = entry;
          break;
        }

        rejections.push({ entry, message: errorMessage(error) });
        remainingEntries.shift();
      }
    }
  } finally {
    // Single write persisting the final state — even if delivery threw
    // something unexpected, successes so far are not replayed on restart.
    try {
      await writeOutbox(scopeKey, remainingEntries);
    } catch (writeError) {
      console.warn("Failed to persist capture outbox:", writeError);
    }
  }

  return {
    attempted: entries.length,
    succeededCount,
    rejections,
    haltedBy,
    remaining: remainingEntries.length,
  };
}
