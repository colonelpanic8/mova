import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import {
  getWidgetCredentials,
  queuePendingTodo,
  getPendingTodos,
  removePendingTodo,
  incrementRetryCount,
  PendingTodo,
} from './storage';

const MAX_RETRIES = 3;

export interface WidgetTaskResult {
  status: 'success' | 'no_auth' | 'queued' | 'retry_complete' | 'unknown_action';
  message?: string;
  error?: string;
}
const BACKOFF_BASE_MS = 2000;
const RESTART_WAIT_MS = 10000;

interface CreateTodoResult {
  success: boolean;
  error?: string;
  shouldRestart?: boolean;
}

/**
 * Create a todo via the API
 */
async function createTodo(
  apiUrl: string,
  username: string,
  password: string,
  title: string
): Promise<CreateTodoResult> {
  try {
    const response = await fetch(`${apiUrl}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
      },
      body: JSON.stringify({ title }),
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 401) {
      return { success: false, error: 'auth_failed' };
    }

    if (response.status === 502 || response.status === 503) {
      return { success: false, error: 'server_unavailable', shouldRestart: true };
    }

    return { success: false, error: `http_${response.status}` };
  } catch (error) {
    return { success: false, error: 'network_error' };
  }
}

/**
 * Request server restart
 */
async function requestRestart(
  apiUrl: string,
  username: string,
  password: string
): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/restart`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
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
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Submit a todo with retry logic
 */
async function submitTodoWithRetry(
  apiUrl: string,
  username: string,
  password: string,
  title: string
): Promise<{ success: boolean; error?: string }> {
  let lastError = '';
  let hasTriedRestart = false;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await createTodo(apiUrl, username, password, title);

    if (result.success) {
      return { success: true };
    }

    // Don't retry auth failures
    if (result.error === 'auth_failed') {
      return { success: false, error: 'Authentication failed' };
    }

    lastError = result.error || 'Unknown error';

    // If server unavailable and we haven't tried restart yet, do it
    if (result.shouldRestart && !hasTriedRestart) {
      console.log('Server unavailable, requesting restart...');
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

  return { success: false, error: lastError };
}

/**
 * Process pending todos queue
 */
async function processPendingTodos(): Promise<void> {
  const credentials = await getWidgetCredentials();
  if (!credentials.apiUrl || !credentials.username || !credentials.password) {
    return;
  }

  const pending = await getPendingTodos();
  for (const todo of pending) {
    if (todo.retryCount >= MAX_RETRIES) {
      // Give up on this todo after max retries
      continue;
    }

    const result = await submitTodoWithRetry(
      credentials.apiUrl,
      credentials.username,
      credentials.password,
      todo.text
    );

    if (result.success) {
      await removePendingTodo(todo.timestamp);
    } else {
      await incrementRetryCount(todo.timestamp);
    }
  }
}

/**
 * Widget task handler - called when widget interactions occur
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<WidgetTaskResult> {
  const { widgetInfo, clickAction, clickActionData } = props;

  if (clickAction === 'SUBMIT_TODO' && clickActionData?.text) {
    const text = clickActionData.text as string;
    const credentials = await getWidgetCredentials();

    if (!credentials.apiUrl || !credentials.username || !credentials.password) {
      // No credentials - queue for later
      await queuePendingTodo(text);
      return {
        status: 'no_auth',
        message: 'Please log in to the Mova app first',
      };
    }

    const result = await submitTodoWithRetry(
      credentials.apiUrl,
      credentials.username,
      credentials.password,
      text
    );

    if (result.success) {
      // Also try to process any pending todos
      await processPendingTodos();
      return { status: 'success' };
    } else {
      // Queue for later retry
      await queuePendingTodo(text);
      return { status: 'queued', error: result.error };
    }
  }

  if (clickAction === 'RETRY_PENDING') {
    await processPendingTodos();
    return { status: 'retry_complete' };
  }

  return { status: 'unknown_action' };
}
