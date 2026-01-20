/**
 * Ad-hoc test to debug custom views with production API
 */

import { by, device, element, expect, waitFor } from "detox";

const API_URL = "https://colonelpanic-org-agenda.fly.dev";
const USERNAME = "imalison";
const PASSWORD = "hamstring splendor emote baggage";

describe("Debug Custom Views", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    // Give the app time to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  it("should login and test custom views", async () => {
    await device.disableSynchronization();
    try {
      // Wait for login screen with longer timeout for slow emulator
      await waitFor(element(by.id("serverUrlInput")))
        .toBeVisible()
        .withTimeout(30000);

      // Fill in login form - tap each field first and wait between fields
      await element(by.id("serverUrlInput")).tap();
      await new Promise((resolve) => setTimeout(resolve, 200));
      await element(by.id("serverUrlInput")).clearText();
      await element(by.id("serverUrlInput")).typeText(API_URL);
      await new Promise((resolve) => setTimeout(resolve, 300));

      await element(by.id("usernameInput")).tap();
      await new Promise((resolve) => setTimeout(resolve, 200));
      await element(by.id("usernameInput")).clearText();
      await element(by.id("usernameInput")).typeText(USERNAME);
      await new Promise((resolve) => setTimeout(resolve, 300));

      await element(by.id("passwordInput")).tap();
      await new Promise((resolve) => setTimeout(resolve, 200));
      await element(by.id("passwordInput")).clearText();
      await element(by.id("passwordInput")).typeText(PASSWORD);
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Dismiss keyboard
      await device.pressBack();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Wait for connect button to be visible and tap
      await waitFor(element(by.id("connectButton")))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id("connectButton")).tap();

      // Wait for main app or error
      try {
        await waitFor(element(by.id("agendaScreen")))
          .toBeVisible()
          .withTimeout(15000);
        console.log("✓ Login successful");
      } catch (e) {
        // Check if there's an error message
        console.log("Login didn't reach agenda screen, checking for errors...");
        try {
          // Check if we're still on login screen
          const loginVisible = await element(
            by.id("serverUrlInput"),
          ).getAttributes();
          console.log("Still on login screen - login may have failed");
          // Try to see if there's an error shown (Snackbar or similar)
          // Take a screenshot for debugging
          await device.takeScreenshot("login-failed");
          throw new Error("Login failed - still on login screen");
        } catch (e2) {
          // Maybe we're somewhere else
          await device.takeScreenshot("unknown-state");
          throw new Error("Unknown state after login attempt");
        }
      }

      // Navigate to Views tab
      await element(by.text("Views")).tap();
      await waitFor(element(by.id("viewsListScreen")))
        .toBeVisible()
        .withTimeout(10000);

      console.log("✓ Views list loaded");

      // Check what views are available
      await expect(element(by.id("viewsList"))).toBeVisible();

      // Try to tap on "Overdue tasks and due today" (key: d) which has entries
      // First try by text
      try {
        await element(by.text("Overdue tasks and due today")).tap();
        console.log("✓ Tapped on 'Overdue tasks' view");
      } catch (e) {
        console.log(
          "Could not find 'Overdue tasks' by text, trying other views",
        );
        // Try another view
        try {
          await element(by.text("Recently created")).tap();
          console.log("✓ Tapped on 'Recently created' view");
        } catch (e2) {
          // Try the first view item
          await element(by.id("viewItem-M")).tap();
          console.log("✓ Tapped on first view (M)");
        }
      }

      // Wait for view entries screen
      await waitFor(element(by.id("viewEntriesScreen")))
        .toBeVisible()
        .withTimeout(10000);

      console.log("✓ View entries screen loaded");

      // Check if we have entries or empty state
      try {
        await expect(element(by.id("viewEntriesList"))).toBeVisible();
        console.log("✓ Entries list is visible - view has items!");
      } catch (e) {
        try {
          await expect(element(by.id("viewEmptyView"))).toBeVisible();
          console.log("⚠ Empty view state shown - no items in this view");
        } catch (e2) {
          console.log(
            "✗ Neither entries list nor empty view visible - something is wrong",
          );
        }
      }

      // Try to go back and test another view
      await element(by.id("viewBackButton")).tap();
      await waitFor(element(by.id("viewsListScreen")))
        .toBeVisible()
        .withTimeout(5000);

      console.log("✓ Back to views list");

      // Try the "Recently created" view which should have 27 entries
      try {
        await element(by.text("Recently created")).tap();
        await waitFor(element(by.id("viewEntriesScreen")))
          .toBeVisible()
          .withTimeout(10000);

        console.log("✓ Recently created view loaded");

        try {
          await expect(element(by.id("viewEntriesList"))).toBeVisible();
          console.log("✓ Recently created has entries!");
        } catch (e) {
          console.log("✗ Recently created shows empty - this is wrong!");
        }
      } catch (e) {
        console.log("Could not test Recently created view:", e);
      }
    } finally {
      await device.enableSynchronization();
    }
  });
});
