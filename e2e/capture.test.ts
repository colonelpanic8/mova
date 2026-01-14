/**
 * E2E tests for the Capture screen functionality.
 *
 * Tests the capture flow with different templates:
 * - Quick Capture (simple todo)
 * - Template-based capture with various prompt types
 *
 * Test templates available:
 * - todo: Title (string)
 * - scheduled-todo: Title (string), When (date)
 * - tagged-todo: Title (string), Tags (tags)
 * - note: Title (string)
 * - meeting: Title (string), Date (date), Attendees (tags), Notes (string)
 */

import { by, device, element, expect, waitFor } from "detox";
import { setupTestWithLoginOnce } from "./helpers/test-helpers";

// Helper function to navigate to capture screen
async function navigateToCaptureScreen(): Promise<void> {
  // Small delay to allow app to stabilize
  await new Promise((resolve) => setTimeout(resolve, 300));
  await device.disableSynchronization();
  try {
    // Check if already on capture screen
    try {
      await waitFor(element(by.id("captureScreen")))
        .toBeVisible()
        .withTimeout(2000);
      return; // Already there
    } catch {
      // Need to navigate
    }

    // Tap on Capture tab using label
    await element(by.label(/Capture/))
      .atIndex(0)
      .tap();
    await waitFor(element(by.id("captureScreen")))
      .toBeVisible()
      .withTimeout(10000);
  } finally {
    await device.enableSynchronization();
  }
}

describe("Capture Screen", () => {
  beforeAll(async () => {
    await setupTestWithLoginOnce();
    // Navigate to capture screen once after login
    await navigateToCaptureScreen();
    // Allow app to stabilize before running tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  describe("Quick Capture", () => {
    it("should capture a simple todo using Quick Capture", async () => {
      await navigateToCaptureScreen();
      await device.disableSynchronization();
      try {
        // Ensure Quick Capture is selected (it should be default)
        // If not, select it from the menu
        await element(by.id("templateSelector")).tap();
        await new Promise((resolve) => setTimeout(resolve, 300));
        // Use atIndex(0) to get the menu item, not the button text
        await element(by.text("Quick Capture")).atIndex(0).tap();
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Tap on Title field to focus and type
        await element(by.text("Title *")).atIndex(0).tap();
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Type in the focused input
        const todoTitle = `Test Todo ${Date.now()}`;
        await element(by.type("android.widget.EditText"))
          .atIndex(0)
          .typeText(todoTitle);

        // Dismiss keyboard before tapping capture button
        await device.pressBack();
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Tap Capture button
        await element(by.id("captureButton")).tap();

        // Wait for success message
        await waitFor(element(by.text("Captured!")))
          .toBeVisible()
          .withTimeout(5000);
      } finally {
        await device.enableSynchronization();
      }
    });
  });

  describe("Template Selection", () => {
    it("should show available templates in dropdown", async () => {
      await navigateToCaptureScreen();
      await device.disableSynchronization();
      try {
        // Open template selector
        await element(by.id("templateSelector")).tap();
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Verify Quick Capture option is shown using testID
        await expect(element(by.id("menuItem-quick-capture"))).toBeVisible();

        // Verify Todo template is shown using testID
        await expect(element(by.id("menuItem-todo"))).toBeVisible();

        // Dismiss menu
        await device.pressBack();
        await new Promise((resolve) => setTimeout(resolve, 300));
      } finally {
        await device.enableSynchronization();
      }
    });
  });

  describe("Custom Template Capture", () => {
    it("should capture using custom Todo template end-to-end", async () => {
      await navigateToCaptureScreen();
      await device.disableSynchronization();
      try {
        // Select Todo template from dropdown - it should be visible without scrolling
        await element(by.id("templateSelector")).tap();
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Try testID first, fall back to text
        try {
          await waitFor(element(by.id("menuItem-todo")))
            .toBeVisible()
            .withTimeout(3000);
          await element(by.id("menuItem-todo")).tap();
        } catch {
          // Fall back to text matching
          await element(by.text("Todo")).atIndex(0).tap();
        }
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Fill in Title field (the only required field for Todo template)
        await element(by.text("Title *")).atIndex(0).tap();
        await new Promise((resolve) => setTimeout(resolve, 200));
        const todoTitle = `Template Todo ${Date.now()}`;
        await element(by.type("android.widget.EditText"))
          .atIndex(0)
          .typeText(todoTitle);

        // Dismiss keyboard
        await device.pressBack();
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Tap Capture button to save
        await element(by.id("captureButton")).tap();

        // Verify success message appears
        await waitFor(element(by.text("Captured!")))
          .toBeVisible()
          .withTimeout(5000);

        // Verify form was cleared (Title field should be empty again)
        await waitFor(element(by.text("Title *")).atIndex(0))
          .toBeVisible()
          .withTimeout(3000);
      } finally {
        await device.enableSynchronization();
      }
    });
  });
});
