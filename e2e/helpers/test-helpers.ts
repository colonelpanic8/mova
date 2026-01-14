/**
 * E2E Test Helpers
 *
 * Provides reusable test utilities including:
 * - Test credentials and API URL
 * - Login helper that should be called at the start of every test
 * - Fresh state helper to ensure clean test environment
 * - Optimized setup that skips login when already logged in
 */

import { by, device, element, expect, waitFor } from 'detox';

// Test container configuration
export const TEST_API_URL = 'http://10.0.2.2:8080'; // Android emulator localhost
export const TEST_USERNAME = 'testuser';
export const TEST_PASSWORD = 'testpass';

/**
 * Launch args for auto-login during tests
 */
const TEST_LAUNCH_ARGS = {
  detoxTestApiUrl: TEST_API_URL,
  detoxTestUsername: TEST_USERNAME,
  detoxTestPassword: TEST_PASSWORD,
};

/**
 * Ensure a completely fresh app state
 * This should be called before login in every test
 */
export async function ensureFreshState(): Promise<void> {
  await device.launchApp({
    newInstance: true,
    delete: true  // Clears all app data including AsyncStorage
  });
}

/**
 * Launch app with auto-login via launch args (bypasses login screen)
 */
export async function launchAppWithAutoLogin(): Promise<void> {
  await device.launchApp({
    newInstance: true,
    delete: true,
    launchArgs: TEST_LAUNCH_ARGS,
  });
}

/**
 * Launch app without clearing data (preserves login state)
 */
export async function launchAppPreserveState(): Promise<void> {
  await device.launchApp({
    newInstance: false,
  });
}

/**
 * Login with test credentials
 * This is a reusable subroutine that every test should call after ensureFreshState
 * Uses disabled synchronization to avoid Detox getting stuck on pending UI operations
 */
export async function loginWithTestCredentials(): Promise<void> {
  await device.disableSynchronization();
  try {
    // Wait for login screen to be visible
    await waitFor(element(by.id('serverUrlInput')))
      .toBeVisible()
      .withTimeout(10000);

    // Clear any existing text and enter test credentials
    await element(by.id('serverUrlInput')).clearText();
    await element(by.id('serverUrlInput')).typeText(TEST_API_URL);

    await element(by.id('usernameInput')).clearText();
    await element(by.id('usernameInput')).typeText(TEST_USERNAME);

    await element(by.id('passwordInput')).clearText();
    await element(by.id('passwordInput')).typeText(TEST_PASSWORD);

    // Dismiss keyboard before tapping connect
    await element(by.id('passwordInput')).tapReturnKey();

    // Wait for keyboard to dismiss and button to be visible
    await new Promise(resolve => setTimeout(resolve, 500));
    await waitFor(element(by.id('connectButton')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap connect button
    await element(by.id('connectButton')).tap();

    // Wait for navigation to main app (tabs should be visible)
    await waitFor(element(by.id('agendaScreen')))
      .toBeVisible()
      .withTimeout(15000);
  } finally {
    await device.enableSynchronization();
  }
}

/**
 * Complete test setup: fresh state + login
 * This is the standard setup that most tests should use
 */
export async function setupTestWithLogin(): Promise<void> {
  await ensureFreshState();
  await loginWithTestCredentials();
}

/**
 * Check if we're on the login screen
 */
async function isOnLoginScreen(): Promise<boolean> {
  try {
    await waitFor(element(by.id('serverUrlInput')))
      .toBeVisible()
      .withTimeout(2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if we're already on the agenda screen (logged in)
 */
async function isAlreadyLoggedIn(): Promise<boolean> {
  try {
    await waitFor(element(by.id('agendaScreen')))
      .toBeVisible()
      .withTimeout(2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Optimized setup that tries launch args for auto-login, falls back to manual login.
 * Use this for test suites where tests can share login state.
 *
 * Usage in test:
 *   describe('MyTests', () => {
 *     beforeAll(async () => {
 *       await setupTestWithLoginOnce();
 *     });
 *     beforeEach(async () => {
 *       await setupTestPreserveLogin();
 *     });
 *   });
 */
export async function setupTestWithLoginOnce(): Promise<void> {
  await launchAppWithAutoLogin();

  // Check if auto-login worked (agendaScreen visible within 5 seconds)
  await device.disableSynchronization();
  try {
    await waitFor(element(by.id('agendaScreen')))
      .toBeVisible()
      .withTimeout(5000);
    await device.enableSynchronization();
    return; // Auto-login worked!
  } catch {
    // Auto-login didn't work, fall back to manual login
    await device.enableSynchronization();
  }

  // Fall back to manual login
  await loginWithTestCredentials();
}

/**
 * Setup for subsequent tests - preserve login state
 */
export async function setupTestPreserveLogin(): Promise<void> {
  await device.launchApp({
    newInstance: false,
    launchArgs: TEST_LAUNCH_ARGS,
  });

  await device.disableSynchronization();
  try {
    // Check if we're on login screen - if so, we need to login
    if (await isOnLoginScreen()) {
      await device.enableSynchronization();
      await loginWithTestCredentials();
      return;
    }

    // We're past the login screen - try to get to agenda
    // First dismiss any open modals by tapping outside or pressing back
    try {
      await device.pressBack();
    } catch {
      // No modal to dismiss
    }

    // Navigate to agenda tab
    try {
      await element(by.text('Agenda')).tap();
    } catch {
      // Already on agenda or can't find tab
    }
  } finally {
    await device.enableSynchronization();
  }
}

/**
 * Navigate to a specific tab
 */
export async function navigateToTab(tabName: 'Agenda' | 'Search' | 'Capture'): Promise<void> {
  await element(by.text(tabName)).tap();
}

/**
 * Wait for loading to complete (no loading indicator visible)
 * Uses disabled synchronization to avoid Detox getting stuck on pending UI operations
 */
export async function waitForLoadingComplete(): Promise<void> {
  await device.disableSynchronization();
  try {
    // First wait for the agenda screen to be visible
    await waitFor(element(by.id('agendaScreen')))
      .toBeVisible()
      .withTimeout(10000);

    // Then wait for loading indicator to disappear (or never appear)
    // Use a try-catch since the indicator might not exist if loading is fast
    try {
      await waitFor(element(by.id('agendaLoadingIndicator')))
        .not.toBeVisible()
        .withTimeout(5000);
    } catch {
      // Loading indicator might not exist - that's fine
    }
  } finally {
    await device.enableSynchronization();
  }
}

/**
 * Pull to refresh on a screen
 */
export async function pullToRefresh(elementId: string): Promise<void> {
  await element(by.id(elementId)).swipe('down', 'slow', 0.75);
}

/**
 * Close any open swipeable by scrolling to top
 */
export async function resetSwipeableState(): Promise<void> {
  try {
    // Scroll to top to close any open swipeables and ensure items are visible
    await element(by.id('agendaList')).scrollTo('top');
  } catch {
    // Ignore if scroll fails
  }
}

/**
 * Scroll to make an element visible
 */
export async function scrollToElement(textOrId: string, isId = false): Promise<void> {
  try {
    if (isId) {
      await waitFor(element(by.id(textOrId)))
        .toBeVisible()
        .whileElement(by.id('agendaList'))
        .scroll(200, 'down');
    } else {
      await waitFor(element(by.text(textOrId)))
        .toBeVisible()
        .whileElement(by.id('agendaList'))
        .scroll(200, 'down');
    }
  } catch {
    // Element might already be visible
  }
}
