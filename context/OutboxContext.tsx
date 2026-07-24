import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { invalidateServerData } from "@/hooks/queryKeys";
import {
  CaptureDeliveryResponse,
  deliverOutboxRequest,
  enqueueOutboxEntry,
  flushOutbox,
  getOutboxEntryTitle,
  isRetryableCaptureError,
  listOutbox,
  OutboxEntry,
  OutboxRequest,
} from "@/services/captureOutbox";
import { buildConfigIdentityKey } from "@/services/configMetadata";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

/**
 * Result of captureOrEnqueue. "delivered" means the server responded (the
 * response may still be a rejection — check response.status); "queued" means
 * the server was unreachable and the capture is persisted for later delivery.
 * Permanent failures (and enqueue failures) are thrown instead.
 */
export type CaptureOrEnqueueResult =
  | { outcome: "delivered"; response: CaptureDeliveryResponse }
  | { outcome: "queued" };

interface OutboxContextType {
  /** Number of captures queued for the active server identity. */
  pendingCount: number;
  /** Queued captures for the active server identity, oldest first. */
  pendingEntries: OutboxEntry[];
  /**
   * Persist a capture for later delivery, then attempt an immediate flush in
   * the background. Throws if the capture could not be persisted, so callers
   * can keep the user's input on screen instead of losing it.
   */
  enqueueCapture: (request: OutboxRequest) => Promise<void>;
  /**
   * Try to deliver a capture now; if the failure is retryable (offline,
   * timeout, transient server error) queue it instead. Throws on permanent
   * failures so callers can keep the user's input on screen.
   */
  captureOrEnqueue: (request: OutboxRequest) => Promise<CaptureOrEnqueueResult>;
  /** Attempt to deliver all queued captures now. */
  flushNow: () => Promise<void>;
  /**
   * User-facing notice about queued captures that were permanently rejected
   * by the server (or dropped due to a full queue). Surfaced so nothing
   * vanishes silently; consume with clearNotice.
   */
  notice: string | null;
  clearNotice: () => void;
}

const OutboxContext = createContext<OutboxContextType | undefined>(undefined);

export function OutboxProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const { apiUrl, username } = useAuth();
  const queryClient = useQueryClient();
  const [pendingEntries, setPendingEntries] = useState<OutboxEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const flushingRef = useRef(false);
  const rerunRef = useRef(false);

  // The outbox is scoped by server identity (url + username) rather than
  // saved-server id: identity exists whenever the user is authenticated,
  // including legacy installs and test logins that have no SavedServer entry.
  const scopeKey = useMemo(
    () =>
      apiUrl && username ? buildConfigIdentityKey(apiUrl, username) : null,
    [apiUrl, username],
  );

  const flushNow = useCallback(async () => {
    if (!api || !scopeKey) return;
    if (flushingRef.current) {
      // A flush is already running; ask it to do another pass when it
      // finishes so entries enqueued mid-flush are not stranded.
      rerunRef.current = true;
      return;
    }

    flushingRef.current = true;
    try {
      do {
        rerunRef.current = false;
        const result = await flushOutbox(scopeKey, api);
        if (result.succeededCount > 0) {
          // Delivered captures created new todos on the server; refresh the
          // affected listings. scopeKey IS the server identity key.
          void invalidateServerData(queryClient, scopeKey);
        }
        if (result.rejections.length > 0) {
          const titles = result.rejections
            .map((rejection) => `"${getOutboxEntryTitle(rejection.entry)}"`)
            .join(", ");
          setNotice(
            result.rejections.length === 1
              ? `Server rejected queued capture: ${titles}`
              : `Server rejected queued captures: ${titles}`,
          );
        }
        setPendingEntries(await listOutbox(scopeKey));
      } while (rerunRef.current);
    } catch (error) {
      console.warn("Capture outbox flush failed:", error);
    } finally {
      flushingRef.current = false;
    }
  }, [api, scopeKey, queryClient]);

  const enqueueCapture = useCallback(
    async (request: OutboxRequest) => {
      if (!scopeKey) {
        throw new Error("Cannot queue capture: not signed in");
      }
      const { droppedCount } = await enqueueOutboxEntry(scopeKey, request);
      if (droppedCount > 0) {
        setNotice(
          `Capture queue was full — dropped ${droppedCount} oldest queued capture${
            droppedCount === 1 ? "" : "s"
          }`,
        );
      }
      const entries = await listOutbox(scopeKey);
      setPendingEntries(entries);
      // Attempt immediate delivery in the background.
      void flushNow();
    },
    [scopeKey, flushNow],
  );

  const captureOrEnqueue = useCallback(
    async (request: OutboxRequest): Promise<CaptureOrEnqueueResult> => {
      if (api) {
        try {
          const response = await deliverOutboxRequest(api, request);
          return { outcome: "delivered", response };
        } catch (error) {
          if (!isRetryableCaptureError(error)) {
            // The server rejected the request; retrying the same payload
            // will not help, so let the caller report it.
            throw error;
          }
          console.warn("Capture failed, queueing for retry:", error);
        }
      }
      // Server unreachable (or transient error): hold the capture in the
      // persistent outbox so it is never lost.
      await enqueueCapture(request);
      return { outcome: "queued" };
    },
    [api, enqueueCapture],
  );

  // Refresh the badge and attempt a flush whenever the api client becomes
  // available or changes (app start, login, server switch).
  useEffect(() => {
    if (!scopeKey) {
      setPendingEntries([]);
      return;
    }
    let cancelled = false;
    void listOutbox(scopeKey).then((entries) => {
      if (!cancelled) setPendingEntries(entries);
    });
    if (api) {
      void flushNow();
    }
    return () => {
      cancelled = true;
    };
  }, [api, scopeKey, flushNow]);

  // Retry when the app returns to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void flushNow();
      }
    });
    return () => subscription.remove();
  }, [flushNow]);

  const clearNotice = useCallback(() => setNotice(null), []);
  const pendingCount = pendingEntries.length;

  const value = useMemo<OutboxContextType>(
    () => ({
      pendingCount,
      pendingEntries,
      enqueueCapture,
      captureOrEnqueue,
      flushNow,
      notice,
      clearNotice,
    }),
    [
      pendingCount,
      pendingEntries,
      enqueueCapture,
      captureOrEnqueue,
      flushNow,
      notice,
      clearNotice,
    ],
  );

  return (
    <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>
  );
}

export function useOutbox(): OutboxContextType {
  const context = useContext(OutboxContext);
  if (context === undefined) {
    throw new Error("useOutbox must be used within an OutboxProvider");
  }
  return context;
}
