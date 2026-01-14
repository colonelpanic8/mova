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

import { by, device, element, expect, waitFor } from 'detox';
import { setupTestWithLoginOnce } from './helpers/test-helpers';

describe('Capture Screen', () => {
  beforeAll(async () => {
    await setupTestWithLoginOnce();
  });

  beforeEach(async () => {
    // Navigate to Capture tab
    await device.disableSynchronization();
    try {
      // Try to dismiss any warning banners by tapping the X
      try {
        await element(by.type('android.widget.ImageView')).atIndex(0).tap();
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch {
        // No warning banner, continue
      }

      // Check if already on capture screen
      try {
        await expect(element(by.id('captureScreen'))).toBeVisible();
        // Already on capture screen
      } catch {
        // Need to navigate - tap on Capture tab using label
        await element(by.label(/Capture/)).atIndex(0).tap();
        await waitFor(element(by.id('captureScreen')))
          .toBeVisible()
          .withTimeout(10000);
      }
    } finally {
      await device.enableSynchronization();
    }
  });

  describe('Quick Capture', () => {
    it('should capture a simple todo using Quick Capture', async () => {
      await device.disableSynchronization();
      try {
        // Ensure Quick Capture is selected (it should be default)
        // If not, select it from the menu
        await element(by.id('templateSelector')).tap();
        await new Promise(resolve => setTimeout(resolve, 300));
        // Use atIndex(0) to get the menu item, not the button text
        await element(by.text('Quick Capture')).atIndex(0).tap();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Tap on Title field to focus and type
        await element(by.text('Title *')).atIndex(0).tap();
        await new Promise(resolve => setTimeout(resolve, 200));

        // Type in the focused input
        const todoTitle = `Test Todo ${Date.now()}`;
        await element(by.type('android.widget.EditText')).atIndex(0).typeText(todoTitle);

        // Tap Capture button
        await element(by.id('captureButton')).tap();

        // Wait for success message
        await waitFor(element(by.text('Captured!')))
          .toBeVisible()
          .withTimeout(5000);
      } finally {
        await device.enableSynchronization();
      }
    });
  });

  describe('Template Selection', () => {
    it('should show available templates in dropdown', async () => {
      await device.disableSynchronization();
      try {
        // Open template selector
        await element(by.id('templateSelector')).tap();
        await new Promise(resolve => setTimeout(resolve, 800));

        // Verify templates are shown (including custom Meeting template)
        await expect(element(by.text('Quick Capture')).atIndex(0)).toBeVisible();
        await expect(element(by.text('Todo'))).toBeVisible();
        await expect(element(by.text('Meeting'))).toBeVisible();

        // Dismiss menu
        await device.pressBack();
        await new Promise(resolve => setTimeout(resolve, 300));
      } finally {
        await device.enableSynchronization();
      }
    });
  });

  describe('Custom Template Capture', () => {
    it('should capture using custom Meeting template end-to-end', async () => {
      await device.disableSynchronization();
      try {
        // Ensure we're on Capture screen first
        await element(by.label(/Capture/)).atIndex(0).tap();
        await waitFor(element(by.id('captureScreen')))
          .toBeVisible()
          .withTimeout(10000);

        // Select Meeting template from dropdown
        await element(by.id('templateSelector')).tap();
        await new Promise(resolve => setTimeout(resolve, 500));
        await element(by.text('Meeting')).tap();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fill in Title field
        await element(by.text('Title *')).atIndex(0).tap();
        await new Promise(resolve => setTimeout(resolve, 200));
        const meetingTitle = `Team Sync ${Date.now()}`;
        await element(by.type('android.widget.EditText')).atIndex(0).typeText(meetingTitle);

        // Dismiss keyboard
        await device.pressBack();
        await new Promise(resolve => setTimeout(resolve, 300));

        // Scroll down to see the date picker button
        await element(by.id('captureScreen')).scroll(100, 'down');
        await new Promise(resolve => setTimeout(resolve, 300));

        // Select Date (required field)
        await element(by.text('Select Date *')).tap();
        await new Promise(resolve => setTimeout(resolve, 800));

        // Accept the date picker (tap OK)
        try {
          await element(by.text('OK')).tap();
        } catch {
          // Try alternative button text
          try {
            await element(by.text('Set')).tap();
          } catch {
            // On some devices, just tap in the center to dismiss
            await device.pressBack();
          }
        }
        await new Promise(resolve => setTimeout(resolve, 500));

        // Tap Capture button to save
        await element(by.id('captureButton')).tap();

        // Verify success message appears
        await waitFor(element(by.text('Captured!')))
          .toBeVisible()
          .withTimeout(5000);

        // Verify form was cleared (Title field should be empty again)
        await waitFor(element(by.text('Title *')).atIndex(0))
          .toBeVisible()
          .withTimeout(3000);
      } finally {
        await device.enableSynchronization();
      }
    });
  });
});
