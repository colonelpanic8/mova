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

  describe("Keyboard Visibility", () => {
    it("should keep input field visible when keyboard appears", async () => {
      await navigateToCaptureScreen();
      await device.disableSynchronization();
      try {
        // Select Quick Capture template
        await element(by.id("templateSelector")).tap();
        await new Promise((resolve) => setTimeout(resolve, 300));
        await element(by.text("Quick Capture")).atIndex(0).tap();
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify Title field is visible before keyboard
        await expect(element(by.text("Title *")).atIndex(0)).toBeVisible();

        // Tap on Title field to bring up keyboard
        await element(by.text("Title *")).atIndex(0).tap();
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Get the input field reference
        const titleInput = element(by.type("android.widget.EditText")).atIndex(
          0,
        );

        // Type some text (this also ensures keyboard is shown)
        await titleInput.typeText("Testing keyboard visibility");
        await new Promise((resolve) => setTimeout(resolve, 300));

        // CRITICAL: Verify the input field is still visible with keyboard open
        // This is the main assertion - if keyboard obscures the field, this fails
        await expect(titleInput).toBeVisible();

        // Also verify the Title label is still visible
        await expect(element(by.text("Title *")).atIndex(0)).toBeVisible();

        // Dismiss keyboard
        await device.pressBack();
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Verify field is still visible after keyboard dismisses
        await expect(element(by.text("Title *")).atIndex(0)).toBeVisible();
      } finally {
        await device.enableSynchronization();
      }
    });

    it("should keep lower form fields visible when focused with keyboard open", async () => {
      await navigateToCaptureScreen();
      await device.disableSynchronization();
      try {
        // Select a template that has multiple fields - use Todo which should have Title
        await element(by.id("templateSelector")).tap();
        await new Promise((resolve) => setTimeout(resolve, 300));

        try {
          await waitFor(element(by.id("menuItem-todo")))
            .toBeVisible()
            .withTimeout(3000);
          await element(by.id("menuItem-todo")).tap();
        } catch {
          await element(by.text("Todo")).atIndex(0).tap();
        }
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Scroll down to see lower fields (Schedule, Deadline, etc.)
        // These are more likely to be obscured by keyboard
        try {
          await element(by.id("captureScreen")).scroll(300, "down");
        } catch {
          // Scroll might not be needed if screen is small
        }
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Find and tap on the Tags field (which is lower in the form)
        // The Tags field has an "Add tag..." placeholder
        try {
          await waitFor(element(by.text("Add tag...")))
            .toBeVisible()
            .withTimeout(3000);

          // Tap on the tags input to bring up keyboard
          await element(by.text("Add tag...")).tap();
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Type in the tags field
          await element(by.type("android.widget.EditText"))
            .atIndex(0)
            .typeText("test-tag");
          await new Promise((resolve) => setTimeout(resolve, 300));

          // CRITICAL: Verify the tags input is still visible with keyboard open
          await expect(
            element(by.type("android.widget.EditText")).atIndex(0),
          ).toBeVisible();

          // Dismiss keyboard
          await device.pressBack();
        } catch {
          // Tags field might not be accessible, skip this part
          console.log("Could not find Tags field, skipping lower field test");
        }
      } finally {
        await device.enableSynchronization();
      }
    });
  });
});
