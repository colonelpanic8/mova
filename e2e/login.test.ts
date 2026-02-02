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

  it("should keep connect button accessible when keyboard is open", async () => {
    // Fill in the server URL first
    await element(by.id("serverUrlInput")).typeText(TEST_API_URL);
    await device.pressBack();

    // Fill in username
    await element(by.id("usernameInput")).typeText(TEST_USERNAME);
    await device.pressBack();

    // Tap on password field to open keyboard
    await element(by.id("passwordInput")).tap();
    await element(by.id("passwordInput")).typeText(TEST_PASSWORD);

    // With keyboard open, the connect button should still be visible/scrollable
    // The KeyboardAwareContainer should adjust the view
    await waitFor(element(by.id("connectButton")))
      .toBeVisible()
      .withTimeout(5000);

    // Should be able to tap the button without dismissing keyboard first
    await element(by.id("connectButton")).tap();

    // Should either login or show error - just verify the button was tappable
    await device.disableSynchronization();
    try {
      // Wait to see if we navigate or get an error message
      await waitFor(element(by.id("agendaScreen")))
        .toBeVisible()
        .withTimeout(30000);
    } finally {
      await device.enableSynchronization();
    }
  });

  it("should successfully login with test credentials and navigate to agenda", async () => {
    await element(by.id("serverUrlInput")).typeText(TEST_API_URL);
    await device.pressBack();
    await element(by.id("usernameInput")).typeText(TEST_USERNAME);
    await device.pressBack();
    await element(by.id("passwordInput")).typeText(TEST_PASSWORD);

    // Dismiss keyboard
    await device.pressBack();

    // Wait for keyboard to dismiss and UI to settle
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Tap connect
    await element(by.id("connectButton")).tap();

    // Disable synchronization to avoid Detox getting stuck on network requests/animations
    await device.disableSynchronization();
    try {
      // Should navigate to agenda screen (longer timeout for login + data load + animations)
      await waitFor(element(by.id("agendaScreen")))
        .toBeVisible()
        .withTimeout(30000);
    } finally {
      await device.enableSynchronization();
    }
  });
});
