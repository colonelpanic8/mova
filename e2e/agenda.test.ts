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

describe('Agenda Screen - Todo Manipulation', () => {
  beforeEach(async () => {
    await setupTestWithLogin();
    await waitForLoadingComplete();
    // Navigate to tomorrow which has test entries
    await element(by.id('agendaNextDay')).tap();
    await waitFor(element(by.id('agendaList')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should reveal swipe actions when swiping left on a todo', async () => {
    // Swipe left on the first todo item to reveal actions
    await element(by.text('Team meeting')).swipe('left', 'fast', 0.5);

    // Should reveal Tomorrow, Schedule, Deadline, Priority buttons
    await expect(element(by.text('Tomorrow'))).toBeVisible();
    await expect(element(by.text('Schedule'))).toBeVisible();
    await expect(element(by.text('Deadline'))).toBeVisible();
    await expect(element(by.text('Priority'))).toBeVisible();
  });

  it('should schedule todo for tomorrow using direct swipe action', async () => {
    // Verify the todo is visible before scheduling
    await expect(element(by.text('Team meeting'))).toBeVisible();

    // Swipe left on a todo to reveal actions
    await element(by.text('Team meeting')).swipe('left', 'fast', 0.5);

    // Tap Tomorrow button directly (no modal)
    await element(by.text('Tomorrow')).tap();

    // Should see success snackbar
    await waitFor(element(by.text(/Scheduled for tomorrow:/)))
      .toBeVisible()
      .withTimeout(5000);

    // Item should be removed from current day's view
    await waitFor(element(by.text('Team meeting')))
      .not.toBeVisible()
      .withTimeout(5000);
  });

  it('should open schedule modal with date picker', async () => {
    // Swipe left on a todo to reveal actions
    await element(by.text('Submit report')).swipe('left', 'fast', 0.5);

    // Tap Schedule button
    await element(by.text('Schedule')).tap();

    // Modal should appear with title and buttons
    await expect(element(by.text('Set Schedule'))).toBeVisible();
    await expect(element(by.text('Save'))).toBeVisible();
    await expect(element(by.text('Cancel'))).toBeVisible();
    await expect(element(by.text('Clear'))).toBeVisible();
  });

  it('should schedule todo for next week using modal quick button', async () => {
    // Verify the todo is visible before scheduling
    await expect(element(by.text('Submit report'))).toBeVisible();

    // Swipe left on Submit report todo
    await element(by.text('Submit report')).swipe('left', 'fast', 0.5);

    // Tap Schedule button to open modal
    await element(by.text('Schedule')).tap();

    // Wait for modal
    await expect(element(by.text('Set Schedule'))).toBeVisible();

    // Tap Next Week button in modal
    await element(by.text('Next Week')).tap();

    // Should see success snackbar
    await waitFor(element(by.text(/Updated:/)))
      .toBeVisible()
      .withTimeout(5000);

    // Item should be removed from current day's view (scheduled to different day)
    await waitFor(element(by.text('Submit report')))
      .not.toBeVisible()
      .withTimeout(5000);
  });

  it('should change todo state by tapping state chip', async () => {
    // Tap on the TODO chip of a todo item
    await element(by.text('TODO')).atIndex(0).tap();

    // State modal should appear
    await expect(element(by.text('Change State'))).toBeVisible();

    // Should see state options
    await expect(element(by.text('DONE'))).toBeVisible();
  });
});
