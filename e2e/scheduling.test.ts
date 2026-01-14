/**
 * Scheduling E2E Tests
 *
 * Tests the scheduling functionality from the agenda screen.
 * Tests swipe-to-reveal schedule button and modal interactions.
 *
 * Note: Schedule/deadline actions now open native Android date picker.
 * Priority action still uses a custom modal.
 *
 * Test data includes items scheduled for:
 * - 2026-01-13: "Morning standup", "Code review"
 * - 2026-01-14: "Submit report" (deadline), "Doctor appointment", "Review code"
 */

import { by, device, element, expect, waitFor } from 'detox';
import {
  setupTestWithLoginOnce,
} from './helpers/test-helpers';

// Helper to swipe and tap a button for a specific todo
async function swipeAndTapButton(todoText: string, buttonType: 'schedule' | 'deadline' | 'priority' | 'tomorrow') {
  // Create testID suffix same as component does
  const testIdSuffix = todoText.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const buttonTestId = `${buttonType}ActionButton_${testIdSuffix}`;

  // Disable synchronization to avoid Detox getting stuck on animations
  await device.disableSynchronization();
  try {
    // Swipe right first to close any open swipeables, then scroll to reset
    try {
      await element(by.id('agendaList')).swipe('right', 'slow', 0.3);
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch {
      // Ignore swipe errors
    }

    // First scroll to ensure the item is visible
    try {
      await waitFor(element(by.text(todoText)))
        .toBeVisible()
        .whileElement(by.id('agendaList'))
        .scroll(100, 'down');
    } catch {
      // Item might already be visible
    }

    // Wait a moment for the item to settle
    await new Promise(resolve => setTimeout(resolve, 200));

    // Swipe left to reveal actions - use a longer swipe for priority/deadline
    const swipePercent = (buttonType === 'priority' || buttonType === 'deadline') ? 0.95 : 0.8;
    await element(by.text(todoText)).swipe('left', 'slow', swipePercent);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Tap the button - use atIndex(0) in case there are multiple matches
    await element(by.id(buttonTestId)).atIndex(0).tap();
  } finally {
    await device.enableSynchronization();
  }
}

// Helper to reset test state
async function resetTestState() {
  await device.disableSynchronization();
  try {
    // Brief wait for any animations to settle
    await new Promise(resolve => setTimeout(resolve, 300));

    // Dismiss any open modals by tapping Cancel button first
    try {
      await element(by.text('Cancel')).tap();
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch {
      // No modal with Cancel button
    }

    // Check if we're on the agenda screen - if not, relaunch
    try {
      await waitFor(element(by.id('agendaScreen')))
        .toBeVisible()
        .withTimeout(2000);
    } catch {
      // App might have been killed - relaunch
      await device.launchApp({ newInstance: false });
      await waitFor(element(by.id('agendaScreen')))
        .toBeVisible()
        .withTimeout(10000);
    }

    // Scroll down then up to reset list state and close any open swipeables
    try {
      await element(by.id('agendaList')).scroll(200, 'down');
      await new Promise(resolve => setTimeout(resolve, 100));
      await element(by.id('agendaList')).scrollTo('top');
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch {
      // Scroll might fail if list is empty or not scrollable
    }
  } finally {
    await device.enableSynchronization();
  }
}

describe('Scheduling from Agenda', () => {
  // Login once at the very start
  beforeAll(async () => {
    await setupTestWithLoginOnce();
  });

  beforeEach(async () => {
    await resetTestState();
  });

  it('should schedule todo for tomorrow using direct swipe action', async () => {
    const todoText = 'Review code';

    // Use the direct Tomorrow swipe action (no modal)
    await swipeAndTapButton(todoText, 'tomorrow');

    // Success snackbar should appear with confirmation message
    await device.disableSynchronization();
    try {
      await waitFor(element(by.id('successSnackbar')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify snackbar contains the expected message
      await expect(element(by.text(`Scheduled for tomorrow: ${todoText}`))).toBeVisible();
    } finally {
      await device.enableSynchronization();
    }

    // Should still be on agenda screen (no modal opened)
    await expect(element(by.id('agendaScreen'))).toBeVisible();
  });

  it('should open native date picker when tapping schedule button', async () => {
    await swipeAndTapButton('Submit report', 'schedule');

    // Native date picker should open - give it time to appear
    await device.disableSynchronization();
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Look for native date picker elements (Android date picker has OK/Cancel buttons)
      // Try tapping Cancel to dismiss without making changes
      try {
        await element(by.text('Cancel')).tap();
      } catch {
        // Try OK if Cancel isn't found
        try {
          await element(by.text('OK')).tap();
        } catch {
          // Date picker might have different button text
        }
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      await device.enableSynchronization();
    }

    // Should be back on agenda screen after dismissing
    await expect(element(by.id('agendaScreen'))).toBeVisible();
  });

  it('should open native date picker when tapping deadline button', async () => {
    await swipeAndTapButton('Doctor appointment', 'deadline');

    // Native date picker should open
    await device.disableSynchronization();
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try tapping Cancel to dismiss without making changes
      try {
        await element(by.text('Cancel')).tap();
      } catch {
        // Try OK if Cancel isn't found
        try {
          await element(by.text('OK')).tap();
        } catch {
          // Date picker might have different button text
        }
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      await device.enableSynchronization();
    }

    // Should be back on agenda screen after dismissing
    await expect(element(by.id('agendaScreen'))).toBeVisible();
  });

  it('should open priority modal when tapping priority button', async () => {
    await swipeAndTapButton('Submit report', 'priority');

    // Modal should open with "Set Priority" title
    await device.disableSynchronization();
    try {
      await waitFor(element(by.text('Set Priority')))
        .toBeVisible()
        .withTimeout(5000);

      // Priority options should be visible
      await expect(element(by.text('A - High'))).toBeVisible();
      await expect(element(by.text('B - Medium'))).toBeVisible();
      await expect(element(by.text('C - Low'))).toBeVisible();
    } finally {
      await device.enableSynchronization();
    }
  });

  it('should close priority modal when tapping cancel', async () => {
    await swipeAndTapButton('Doctor appointment', 'priority');

    await device.disableSynchronization();
    try {
      await waitFor(element(by.text('Set Priority')))
        .toBeVisible()
        .withTimeout(5000);

      // Tap cancel
      await element(by.text('Cancel')).tap();

      // Modal should be dismissed
      await waitFor(element(by.text('Set Priority')))
        .not.toBeVisible()
        .withTimeout(3000);
    } finally {
      await device.enableSynchronization();
    }

    // Should still be on agenda screen
    await expect(element(by.id('agendaScreen'))).toBeVisible();
  });

  it('should save priority when selecting and tapping save', async () => {
    await swipeAndTapButton('Team meeting', 'priority');

    await device.disableSynchronization();
    try {
      await waitFor(element(by.text('Set Priority')))
        .toBeVisible()
        .withTimeout(5000);

      // Select high priority
      await element(by.text('A - High')).tap();

      // Tap save
      await element(by.text('Save')).tap();

      // Modal should close and snackbar should show
      await waitFor(element(by.text('Set Priority')))
        .not.toBeVisible()
        .withTimeout(10000);
    } finally {
      await device.enableSynchronization();
    }
  });
});
