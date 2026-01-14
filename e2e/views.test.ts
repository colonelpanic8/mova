/**
 * E2E tests for the Views screen functionality.
 *
 * Tests the custom views feature which displays filtered lists of todos:
 * - NEXT actions (key: n)
 * - STARTED tasks (key: s)
 * - WAITING tasks (key: w)
 * - High priority (key: h)
 * - Work tasks (key: W)
 */

import { by, device, element, expect, waitFor } from 'detox';
import { setupTestWithLoginOnce } from './helpers/test-helpers';

// Helper to navigate to Views tab (handles warning banner issue)
async function navigateToViewsTab() {
  // Try to dismiss any warning banners first
  try {
    await element(by.type('android.widget.ImageView')).atIndex(0).tap();
    await new Promise(resolve => setTimeout(resolve, 200));
  } catch {
    // No banner
  }

  // Tap the Views tab
  await element(by.text('Views')).atIndex(0).tap();
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Wait for views list to load
  await waitFor(element(by.id('viewsList')))
    .toBeVisible()
    .withTimeout(15000);
}

describe('Views Screen', () => {
  beforeAll(async () => {
    await setupTestWithLoginOnce();
  });

  beforeEach(async () => {
    await device.disableSynchronization();
    try {
      // Brief wait for animations
      await new Promise(resolve => setTimeout(resolve, 300));

      // Dismiss any modals
      try {
        await element(by.text('Cancel')).tap();
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch {
        // No modal
      }

      // If we're on View entries screen, go back to list first
      try {
        await expect(element(by.id('viewEntriesScreen'))).toBeVisible();
        await element(by.id('viewBackButton')).tap();
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch {
        // Not on entries screen
      }

      // Navigate back to Agenda tab if not already there
      try {
        await expect(element(by.id('agendaScreen'))).toBeVisible();
      } catch {
        // Not on agenda - try tapping Agenda tab
        try {
          await element(by.text('Agenda')).atIndex(0).tap();
          await waitFor(element(by.id('agendaScreen')))
            .toBeVisible()
            .withTimeout(5000);
        } catch {
          // Relaunch app
          await device.launchApp({ newInstance: false });
          await waitFor(element(by.id('agendaScreen')))
            .toBeVisible()
            .withTimeout(10000);
        }
      }
    } finally {
      await device.enableSynchronization();
    }
  });

  it('should navigate to Views tab and show custom views', async () => {
    await device.disableSynchronization();
    try {
      await navigateToViewsTab();

      // Check that expected views are shown
      await expect(element(by.text('Next actions'))).toBeVisible();
      await expect(element(by.text('Started tasks'))).toBeVisible();
      await expect(element(by.text('Waiting tasks'))).toBeVisible();
    } finally {
      await device.enableSynchronization();
    }
  });

  it('should open NEXT actions view and show entries', async () => {
    await device.disableSynchronization();
    try {
      await navigateToViewsTab();

      // Tap on the Next actions view
      await element(by.id('viewItem-n')).tap();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should show the entries screen
      await waitFor(element(by.id('viewEntriesScreen')))
        .toBeVisible()
        .withTimeout(5000);

      // Should show the view title
      await expect(element(by.text('Next actions'))).toBeVisible();

      // Should have entries list with NEXT items
      await waitFor(element(by.id('viewEntriesList')))
        .toBeVisible()
        .withTimeout(5000);
    } finally {
      await device.enableSynchronization();
    }
  });

  it('should open STARTED tasks view', async () => {
    await device.disableSynchronization();
    try {
      await navigateToViewsTab();

      // Tap on Started tasks view
      await element(by.id('viewItem-s')).tap();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should show entries screen
      await waitFor(element(by.id('viewEntriesScreen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.text('Started tasks'))).toBeVisible();
    } finally {
      await device.enableSynchronization();
    }
  });

  it('should navigate back from view entries to views list', async () => {
    await device.disableSynchronization();
    try {
      await navigateToViewsTab();

      // Open a view
      await element(by.id('viewItem-n')).tap();
      await waitFor(element(by.id('viewEntriesScreen')))
        .toBeVisible()
        .withTimeout(5000);

      // Tap back button
      await element(by.id('viewBackButton')).tap();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should be back to views list
      await waitFor(element(by.id('viewsListScreen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify views are still shown
      await expect(element(by.text('Next actions'))).toBeVisible();
    } finally {
      await device.enableSynchronization();
    }
  });
});
