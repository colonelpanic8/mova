import { by, device, element, expect, waitFor } from "detox";
import {
  ensureFreshState,
  TEST_API_URL,
  TEST_PASSWORD,
  TEST_USERNAME,
} from "./helpers/test-helpers";

describe("Login Screen", () => {
  beforeEach(async () => {
    // Every test starts with a completely fresh app state
    await ensureFreshState();
  });

  it("should show login screen with all fields", async () => {
    await expect(element(by.id("serverUrlInput"))).toBeVisible();
    await expect(element(by.id("usernameInput"))).toBeVisible();
    await expect(element(by.id("passwordInput"))).toBeVisible();
    await expect(element(by.id("connectButton"))).toBeVisible();
  });

  it("should show error when submitting empty fields", async () => {
    // Dismiss any keyboard that might be open
    await device.pressBack();
    await element(by.id("connectButton")).tap();
    await expect(element(by.text("All fields are required"))).toBeVisible();
  });

  it("should allow typing in all fields", async () => {
    await element(by.id("serverUrlInput")).typeText(TEST_API_URL);
    // Dismiss keyboard before typing in next field to avoid overlap issues
    await device.pressBack();
    await element(by.id("usernameInput")).typeText(TEST_USERNAME);
    await device.pressBack();
    await element(by.id("passwordInput")).typeText(TEST_PASSWORD);
    // Dismiss keyboard before checking button visibility
    await device.pressBack();

    // Verify the connect button is still visible and tappable
    await expect(element(by.id("connectButton"))).toBeVisible();
  });

  it("should successfully login with test credentials and navigate to agenda", async () => {
    await element(by.id("serverUrlInput")).typeText(TEST_API_URL);
    await device.pressBack();
    await element(by.id("usernameInput")).typeText(TEST_USERNAME);
    await device.pressBack();
    await element(by.id("passwordInput")).typeText(TEST_PASSWORD);

    // Dismiss keyboard
    await device.pressBack();

    // Wait for keyboard to dismiss
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Tap connect
    await element(by.id("connectButton")).tap();

    // Disable synchronization to avoid Detox getting stuck on network requests/animations
    await device.disableSynchronization();
    try {
      // Should navigate to agenda screen (longer timeout for login + data load)
      await waitFor(element(by.id("agendaScreen")))
        .toBeVisible()
        .withTimeout(15000);
    } finally {
      await device.enableSynchronization();
    }
  });
});
