/**
 * Agenda Screen E2E Tests
 *
 * Tests that the agenda page UI works correctly.
 * Uses test container with known test data.
 *
 * Test data includes items scheduled for:
 * - 2026-01-13: "Morning standup", "Code review"
 * - 2026-01-14: "Team meeting", "Submit report", "Doctor appointment", "Review code"
 */

import { by, element, expect, waitFor } from 'detox';
import { setupTestWithLogin, navigateToTab, waitForLoadingComplete } from './helpers/test-helpers';

describe('Agenda Screen', () => {
  beforeEach(async () => {
    // Every test starts fresh with a new app instance and login
    await setupTestWithLogin();
  });

  it('should show agenda screen after login', async () => {
    // Agenda screen should be visible (it's the default tab)
    await expect(element(by.id('agendaScreen'))).toBeVisible();
  });

  it('should display the date header', async () => {
    await expect(element(by.id('agendaDateHeader'))).toBeVisible();
  });

  it('should have navigation buttons', async () => {
    await expect(element(by.id('agendaPrevDay'))).toBeVisible();
    await expect(element(by.id('agendaNextDay'))).toBeVisible();
  });

  it('should navigate between days', async () => {
    await waitForLoadingComplete();

    // Get current date header text
    const dateHeader = element(by.id('agendaDateHeader'));
    await expect(dateHeader).toBeVisible();

    // Navigate forward
    await element(by.id('agendaNextDay')).tap();

    // Navigate back
    await element(by.id('agendaPrevDay')).tap();

    // Should still be on agenda screen
    await expect(element(by.id('agendaScreen'))).toBeVisible();
  });

  it('should populate agenda with entries from API', async () => {
    await waitForLoadingComplete();

    // Navigate to tomorrow which has multiple test entries
    await element(by.id('agendaNextDay')).tap();

    // Wait for agenda list to be visible
    await waitFor(element(by.id('agendaList')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify multiple entries are shown
    await expect(element(by.text('Team meeting'))).toBeVisible();
    await expect(element(by.text('Submit report'))).toBeVisible();

    // Verify TODO state is visible
    await expect(element(by.text('TODO')).atIndex(0)).toBeVisible();
  });

  it('should refresh when pulling down', async () => {
    await waitForLoadingComplete();
    await element(by.id('agendaNextDay')).tap();
    await waitFor(element(by.id('agendaList')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('agendaList')).swipe('down', 'slow', 0.75);
    await expect(element(by.text('Team meeting'))).toBeVisible();
  });
});

describe('Agenda Screen - Tab Navigation', () => {
  beforeEach(async () => {
    await setupTestWithLogin();
  });

  it('should navigate to Search tab and back to Agenda', async () => {
    // Navigate to Search
    await navigateToTab('Search');
    await expect(element(by.id('searchScreen'))).toBeVisible();

    // Navigate back to Agenda
    await navigateToTab('Agenda');
    await expect(element(by.id('agendaScreen'))).toBeVisible();
  });

  it('should preserve agenda data after tab switch', async () => {
    await waitForLoadingComplete();
    await element(by.id('agendaNextDay')).tap();
    await waitFor(element(by.text('Team meeting')))
      .toBeVisible()
      .withTimeout(10000);
    await navigateToTab('Search');
    await navigateToTab('Agenda');
    await expect(element(by.text('Team meeting'))).toBeVisible();
  });
});
