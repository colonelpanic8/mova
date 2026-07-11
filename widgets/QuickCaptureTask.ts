import { base64Encode } from "@/utils/base64";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import {
  gcPendingTodos,
  getPendingTodos,
  getWidgetCredentials,
  queuePendingTodo,
  removePendingTodo,
} from "./storage";

const MAX_RETRIES = 3;
// Per-request timeout for widget fetches so a hung connection can't wedge the
// background task. Matches the OrgAgendaApi default.
const FETCH_TIMEOUT_MS = 15000;

/**
 * fetch with an AbortController-based timeout that is always cleaned up.
 */
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface WidgetTaskResult {
  status:
    | "success"
    | "no_auth"
    | "queued"
    | "retry_complete"
    | "unknown_action";
  message?: string;
  error?: string;
}
const BACKOFF_BASE_MS = 2000;
const RESTART_WAIT_MS = 10000;

interface CaptureResult {
  success: boolean;
  error?: string;
  // HTTP status of the response, when one was received. Absent for
  // network/timeout failures where no response arrived.
  status?: number;
  shouldRestart?: boolean;
}

interface SubmitResult {
  success: boolean;
  error?: string;
  // HTTP status of the last failing response, carried so the flush path can
  // distinguish permanent client rejections from transient failures.
  status?: number;
}

/**
 * Whether an HTTP status is a permanent client rejection that will never
 * succeed on retry, so a queued todo should be dropped rather than re-driven
 * through the retry/backoff loop on every flush.
 *
 * 4xx statuses are permanent EXCEPT:
 * - 401: handled separately as an auth failure (may succeed after re-login).
 * - 408 (request timeout) / 429 (too many requests): transient, worth retrying.
 */
export function isPermanentRejection(status: number | undefined): boolean {
  if (status === undefined) return false;
  if (status < 400 || status >= 500) return false;
  return status !== 401 && status !== 408 && status !== 429;
}

/**
 * Capture a todo via the API using the default template
 */
async function captureTodo(
  apiUrl: string,
  username: string,
  password: string,
  title: string,
): Promise<CaptureResult> {
  try {
    const response = await fetchWithTimeout(`${apiUrl}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${base64Encode(`${username}:${password}`)}`,
      },
      body: JSON.stringify({
        template: "default",
        values: { Title: title },
      }),
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 401) {
      return { success: false, error: "auth_failed", status: 401 };
    }

    if (response.status === 502 || response.status === 503) {
      return {
        success: false,
        error: "server_unavailable",
        status: response.status,
        shouldRestart: true,
      };
    }

    return {
      success: false,
      error: `http_${response.status}`,
      status: response.status,
    };
  } catch (error) {
    return { success: false, error: "network_error" };
  }
}

/**
 * Request server restart
 */
async function requestRestart(
  apiUrl: string,
  username: string,
  password: string,
): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${apiUrl}/restart`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${base64Encode(`${username}:${password}`)}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Submit a todo with retry logic
 */
async function submitTodoWithRetry(
  apiUrl: string,
  username: string,
  password: string,
  title: string,
): Promise<SubmitResult> {
  let lastError = "";
  let lastStatus: number | undefined;
  let hasTriedRestart = false;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await captureTodo(apiUrl, username, password, title);

    if (result.success) {
      return { success: true };
    }

    // Don't retry auth failures
    if (result.error === "auth_failed") {
      return {
        success: false,
        error: "Authentication failed",
        status: result.status,
      };
    }

    // Permanent client rejection (e.g. 400/422): retrying can't help, so bail
    // out immediately instead of burning the full backoff loop. The caller
    // drops the todo from the queue.
    if (isPermanentRejection(result.status)) {
      return {
        success: false,
        error: result.error || "Unknown error",
        status: result.status,
      };
    }

    lastError = result.error || "Unknown error";
    lastStatus = result.status;

    // If server unavailable and we haven't tried restart yet, do it
    if (result.shouldRestart && !hasTriedRestart) {
      console.log("Server unavailable, requesting restart...");
      await requestRestart(apiUrl, username, password);
      hasTriedRestart = true;
      await sleep(RESTART_WAIT_MS);
      continue; // Don't count this as a retry attempt
    }

    // Exponential backoff before next retry
    if (attempt < MAX_RETRIES - 1) {
      const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
      console.log(`Retry ${attempt + 1}/${MAX_RETRIES} in ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }

  return { success: false, error: lastError, status: lastStatus };
}

/**
 * Process pending todos queue
 */
async function processPendingTodos(): Promise<void> {
  const credentials = await getWidgetCredentials();
  if (!credentials.apiUrl || !credentials.username || !credentials.password) {
    return;
  }

  // Drop entries too old to be worth retrying before we flush the rest. We
  // never give up on a capture silently otherwise: every flush re-attempts
  // all remaining pending todos.
  await gcPendingTodos();

  const pending = await getPendingTodos();
  for (const todo of pending) {
    const result = await submitTodoWithRetry(
      credentials.apiUrl,
      credentials.username,
      credentials.password,
      todo.text,
    );

    if (result.success) {
      await removePendingTodo(todo.timestamp);
    } else if (isPermanentRejection(result.status)) {
      // The server rejected this capture with a permanent 4xx (e.g. 400/422).
      // Retrying will never succeed, so drop it instead of re-driving the
      // retry loop on every flush. The widget has no snackbar surface, so a
      // log line is the only diagnostic we can leave behind.
      console.warn(
        `[Widget] Dropping permanently-rejected pending todo (HTTP ${result.status}): "${todo.text}"`,
      );
      await removePendingTodo(todo.timestamp);
    }
    // Otherwise (transient network/timeout/5xx/408/429 or auth failure) keep
    // the todo queued and retry it on the next flush.
  }
}

/**
 * Widget task handler - called when widget interactions occur
 */
export async function widgetTaskHandler(
  props: WidgetTaskHandlerProps,
): Promise<WidgetTaskResult> {
  const { widgetInfo, clickAction, clickActionData } = props;

  if (clickAction === "SUBMIT_TODO" && clickActionData?.text) {
    const text = clickActionData.text as string;
    const credentials = await getWidgetCredentials();

    if (!credentials.apiUrl || !credentials.username || !credentials.password) {
      // No credentials - queue for later
      await queuePendingTodo(text);
      return {
        status: "no_auth",
        message: "Please log in to the Mova app first",
      };
    }

    const result = await submitTodoWithRetry(
      credentials.apiUrl,
      credentials.username,
      credentials.password,
      text,
    );

    if (result.success) {
      // Also try to process any pending todos
      await processPendingTodos();
      return { status: "success" };
    } else {
      // Queue for later retry
      await queuePendingTodo(text);
      return { status: "queued", error: result.error };
    }
  }

  if (clickAction === "RETRY_PENDING") {
    await processPendingTodos();
    return { status: "retry_complete" };
  }

  return { status: "unknown_action" };
}
