import { by, device, element, expect, waitFor } from 'detox';
import { ensureFreshState, TEST_API_URL, TEST_USERNAME, TEST_PASSWORD } from './helpers/test-helpers';

describe('Login Screen', () => {
  beforeEach(async () => {
    // Every test starts with a completely fresh app state
    await ensureFreshState();
  });

  it('should show login screen with all fields', async () => {
    await expect(element(by.id('serverUrlInput'))).toBeVisible();
    await expect(element(by.id('usernameInput'))).toBeVisible();
    await expect(element(by.id('passwordInput'))).toBeVisible();
    await expect(element(by.id('connectButton'))).toBeVisible();
  });

  it('should show error when submitting empty fields', async () => {
    await element(by.id('connectButton')).tap();
    await expect(element(by.text('All fields are required'))).toBeVisible();
  });

  it('should allow typing in all fields', async () => {
    await element(by.id('serverUrlInput')).typeText(TEST_API_URL);
    await element(by.id('usernameInput')).typeText(TEST_USERNAME);
    await element(by.id('passwordInput')).typeText(TEST_PASSWORD);

    // Verify the connect button is still visible and tappable
    await expect(element(by.id('connectButton'))).toBeVisible();
  });

  it('should successfully login with test credentials and navigate to agenda', async () => {
    await element(by.id('serverUrlInput')).typeText(TEST_API_URL);
    await element(by.id('usernameInput')).typeText(TEST_USERNAME);
    await element(by.id('passwordInput')).typeText(TEST_PASSWORD);

    // Dismiss keyboard
    await element(by.id('passwordInput')).tapReturnKey();

    // Tap connect
    await element(by.id('connectButton')).tap();

    // Should navigate to agenda screen
    await waitFor(element(by.id('agendaScreen')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
