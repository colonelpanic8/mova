/**
 * E2E tests for the Views screen functionality.
 *
 * Tests the custom views feature which displays filtered lists of todos.
 * The test container has a view "n" named "Agenda and all TODOs".
 */

import { by, device, element, expect, waitFor } from 'detox';
import { setupTestWithLoginOnce } from './helpers/test-helpers';

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

      // Make sure we're on the agenda screen first
      try {
        await waitFor(element(by.id('agendaScreen')))
          .toBeVisible()
          .withTimeout(2000);
      } catch {
        // Relaunch app
        await device.launchApp({ newInstance: false });
        await waitFor(element(by.id('agendaScreen')))
          .toBeVisible()
          .withTimeout(10000);
      }
    } finally {
      await device.enableSynchronization();
    }
  });

  it('should navigate to Views tab', async () => {
    await device.disableSynchronization();
    try {
      // Tap the Views tab
      await element(by.text('Views')).atIndex(0).tap();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait for views content to load
      await waitFor(element(by.id('viewsListScreen')))
        .toBeVisible()
        .withTimeout(10000);
    } finally {
      await device.enableSynchronization();
    }
  });

  it('should display list of custom views', async () => {
    await device.disableSynchronization();
    try {
      // Navigate to Views tab
      await element(by.text('Views')).atIndex(0).tap();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for views list to load
      await waitFor(element(by.id('viewsList')))
        .toBeVisible()
        .withTimeout(15000);

      // Check that a view is shown
      await expect(element(by.text('Agenda and all TODOs'))).toBeVisible();
    } finally {
      await device.enableSynchronization();
    }
  });

  it('should open a custom view and show entries', async () => {
    await device.disableSynchronization();
    try {
      // Navigate to Views tab
      await element(by.text('Views')).atIndex(0).tap();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for views list
      await waitFor(element(by.id('viewsList')))
        .toBeVisible()
        .withTimeout(15000);

      // Tap on the view item
      await element(by.id('viewItem-n')).tap();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should show the entries screen
      await waitFor(element(by.id('viewEntriesScreen')))
        .toBeVisible()
        .withTimeout(5000);

      // Should show the view title
      await expect(element(by.text('Agenda and all TODOs'))).toBeVisible();
    } finally {
      await device.enableSynchronization();
    }
  });

  it('should navigate back from view entries to views list', async () => {
    await device.disableSynchronization();
    try {
      // Navigate to Views tab
      await element(by.text('Views')).atIndex(0).tap();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for views list
      await waitFor(element(by.id('viewsList')))
        .toBeVisible()
        .withTimeout(15000);

      // Tap on the view item
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
    } finally {
      await device.enableSynchronization();
    }
  });
});
