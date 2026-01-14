/**
 * E2E Test Helpers
 *
 * Provides reusable test utilities including:
 * - Test credentials and API URL
 * - Login helper that should be called at the start of every test
 * - Fresh state helper to ensure clean test environment
 */

import { by, device, element, expect } from 'detox';

// Test container configuration
export const TEST_API_URL = 'http://10.0.2.2:8080'; // Android emulator localhost
export const TEST_USERNAME = 'testuser';
export const TEST_PASSWORD = 'testpass';

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
 * Login with test credentials
 * This is a reusable subroutine that every test should call after ensureFreshState
 */
export async function loginWithTestCredentials(): Promise<void> {
  // Wait for login screen to be visible
  await expect(element(by.id('serverUrlInput'))).toBeVisible();

  // Clear any existing text and enter test credentials
  await element(by.id('serverUrlInput')).clearText();
  await element(by.id('serverUrlInput')).typeText(TEST_API_URL);

  await element(by.id('usernameInput')).clearText();
  await element(by.id('usernameInput')).typeText(TEST_USERNAME);

  await element(by.id('passwordInput')).clearText();
  await element(by.id('passwordInput')).typeText(TEST_PASSWORD);

  // Dismiss keyboard before tapping connect
  await element(by.id('passwordInput')).tapReturnKey();

  // Tap connect button
  await element(by.id('connectButton')).tap();

  // Wait for navigation to main app (tabs should be visible)
  await waitFor(element(by.id('agendaScreen')))
    .toBeVisible()
    .withTimeout(10000);
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
 * Navigate to a specific tab
 */
export async function navigateToTab(tabName: 'Agenda' | 'Search' | 'Capture'): Promise<void> {
  await element(by.text(tabName)).tap();
}

/**
 * Wait for loading to complete (no loading indicator visible)
 */
export async function waitForLoadingComplete(): Promise<void> {
  await waitFor(element(by.id('agendaLoadingIndicator')))
    .not.toBeVisible()
    .withTimeout(10000);
}

/**
 * Pull to refresh on a screen
 */
export async function pullToRefresh(elementId: string): Promise<void> {
  await element(by.id(elementId)).swipe('down', 'slow', 0.75);
}
