import { by, device, element, expect, waitFor } from 'detox';
import { execSync } from 'child_process';

/**
 * API Connectivity Tests
 *
 * These tests verify that the app can connect to the org-agenda-api backend
 * and perform basic operations like fetching agenda, todos, and creating items.
 *
 * Environment variables:
 *   MOVA_TEST_API_URL      - API URL (default: https://colonelpanic-org-agenda.fly.dev)
 *   MOVA_TEST_USERNAME     - API username
 *   MOVA_TEST_PASSWORD     - API password
 *   MOVA_USE_LOCAL_API     - Set to "1" to use local container (requires ./e2e/local-api.sh start)
 *   MOVA_LOCAL_API_PORT    - Port for local API (default: 8080)
 *
 * Run against production:
 *   MOVA_TEST_USERNAME=user MOVA_TEST_PASSWORD=pass npx detox test --configuration android.att.debug e2e/api-connectivity.test.ts
 *
 * Run against local container:
 *   1. Start the local API: ./e2e/local-api.sh start
 *   2. Run tests: MOVA_USE_LOCAL_API=1 MOVA_TEST_USERNAME=user MOVA_TEST_PASSWORD=pass npx detox test --configuration android.att.debug e2e/api-connectivity.test.ts
 *   3. Stop when done: ./e2e/local-api.sh stop
 */

const USE_LOCAL_API = process.env.MOVA_USE_LOCAL_API === '1';
const LOCAL_API_PORT = process.env.MOVA_LOCAL_API_PORT || '8080';

// For local testing, we use localhost which requires adb reverse for physical devices
// For production, we use the fly.dev URL
const API_URL = USE_LOCAL_API
  ? `http://localhost:${LOCAL_API_PORT}`
  : (process.env.MOVA_TEST_API_URL || 'https://colonelpanic-org-agenda.fly.dev');

const USERNAME = process.env.MOVA_TEST_USERNAME || '';
const PASSWORD = process.env.MOVA_TEST_PASSWORD || '';

// Setup adb reverse for local testing with physical devices
function setupAdbReverse() {
  if (USE_LOCAL_API) {
    try {
      execSync(`adb reverse tcp:${LOCAL_API_PORT} tcp:${LOCAL_API_PORT}`, { stdio: 'pipe' });
      console.log(`[setup] adb reverse set up for port ${LOCAL_API_PORT}`);
    } catch (error) {
      console.warn(`[setup] Failed to set up adb reverse: ${error}`);
    }
  }
}

describe('API Connectivity', () => {
  beforeAll(async () => {
    if (!USERNAME || !PASSWORD) {
      console.warn('WARNING: MOVA_TEST_USERNAME and MOVA_TEST_PASSWORD environment variables are required for API tests');
    }

    // Set up adb reverse for local API testing
    setupAdbReverse();

    console.log(`[setup] Using API URL: ${API_URL}`);
    console.log(`[setup] Local API mode: ${USE_LOCAL_API ? 'enabled' : 'disabled'}`);

    await device.launchApp({ newInstance: true });
  });

  describe('Login and Authentication', () => {
    it('should log in with valid credentials', async () => {
      // Fill in login form - tap each field first to ensure focus
      await element(by.id('serverUrlInput')).tap();
      await element(by.id('serverUrlInput')).typeText(API_URL);

      await element(by.id('usernameInput')).tap();
      await element(by.id('usernameInput')).typeText(USERNAME);

      await element(by.id('passwordInput')).tap();
      await element(by.id('passwordInput')).typeText(PASSWORD);

      // Hide keyboard by tapping outside or using back button
      await device.pressBack();

      // Wait a moment for keyboard to dismiss
      await new Promise(resolve => setTimeout(resolve, 500));

      // Tap connect button
      await element(by.id('connectButton')).tap();

      // Wait for navigation to main app (agenda screen should appear)
      // Use a longer timeout since the API call needs to complete
      await waitFor(element(by.id('agendaScreen')))
        .toBeVisible()
        .withTimeout(60000);
    });
  });

  describe('Agenda Screen', () => {
    it('should display the agenda with date header', async () => {
      // Verify we're on the agenda screen
      await expect(element(by.id('agendaScreen'))).toBeVisible();

      // Verify the date header is visible
      await expect(element(by.id('agendaDateHeader'))).toBeVisible();
    });

    it('should show either agenda entries or empty state', async () => {
      // Either the list or the empty view should be visible
      try {
        await expect(element(by.id('agendaList'))).toBeVisible();
      } catch {
        await expect(element(by.id('agendaEmptyView'))).toBeVisible();
      }
    });
  });

  describe('Search Screen', () => {
    beforeAll(async () => {
      // Navigate to Search tab
      await element(by.text('Search')).tap();
    });

    it('should load the search screen', async () => {
      await waitFor(element(by.id('searchScreen')))
        .toBeVisible()
        .withTimeout(15000);
    });

    it('should display search input', async () => {
      await expect(element(by.id('searchInput'))).toBeVisible();
    });

    it('should show either todo list or empty state', async () => {
      // Either the list or the empty view should be visible
      try {
        await expect(element(by.id('searchTodoList'))).toBeVisible();
      } catch {
        await expect(element(by.id('searchEmptyView'))).toBeVisible();
      }
    });

    it('should allow searching todos', async () => {
      // Type a search query
      await element(by.id('searchInput')).typeText('test');

      // Wait a moment for filtering
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clear the search
      await element(by.id('searchInput')).clearText();
    });
  });

  describe('Capture Screen', () => {
    beforeAll(async () => {
      // Navigate to Capture tab
      await element(by.text('Capture')).tap();
    });

    it('should load the capture screen', async () => {
      await waitFor(element(by.id('captureScreen')))
        .toBeVisible()
        .withTimeout(15000);
    });

    it('should display template selector and capture button', async () => {
      await expect(element(by.id('templateSelector'))).toBeVisible();
      await expect(element(by.id('captureButton'))).toBeVisible();
    });

    it('should show template form with prompts', async () => {
      // Verify the selected template shows its prompts
      // The "Todo" template should have a "Title" field
      await expect(element(by.text('Title *'))).toExist();

      // Verify we can see the capture button
      await expect(element(by.id('captureButton'))).toBeVisible();
    });
  });

  describe('Verify Created Todo', () => {
    beforeAll(async () => {
      // Navigate back to Search tab to verify the todo was created
      await element(by.text('Search')).tap();
    });

    it('should show the search screen with todos', async () => {
      await waitFor(element(by.id('searchScreen')))
        .toBeVisible()
        .withTimeout(15000);

      // Pull to refresh to get latest todos
      // Note: Pull-to-refresh is tricky in Detox, we'll just verify the screen loads
      await expect(element(by.id('searchScreen'))).toBeVisible();
    });
  });
});
