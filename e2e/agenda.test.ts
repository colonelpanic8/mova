/**
 * Agenda Screen E2E Tests
 *
 * Tests that the agenda page UI works correctly.
 * Uses test container with known test data.
 *
 * IMPORTANT: Today's date for testing should be 2026-01-21.
 * Test data includes items scheduled for:
 * - 2026-01-20: "Morning standup", "Code review"
 * - 2026-01-21 (TODAY): "Team meeting", "Submit report", "Doctor appointment"
 * - 2026-01-22: "Review code", "Update dependencies"
 */

import { by, element, expect, waitFor } from "detox";
import {
  navigateToTab,
  setupTestWithLogin,
  waitForLoadingComplete,
} from "./helpers/test-helpers";

describe("Agenda Screen", () => {
  beforeEach(async () => {
    // Every test starts fresh with a new app instance and login
    await setupTestWithLogin();
  });

  it("should show agenda screen after login", async () => {
    // Agenda screen should be visible (it's the default tab)
    await expect(element(by.id("agendaScreen"))).toBeVisible();
  });

  it("should display the date header", async () => {
    await expect(element(by.id("agendaDateHeader"))).toBeVisible();
  });

  it("should have navigation buttons", async () => {
    await expect(element(by.id("agendaPrevDay"))).toBeVisible();
    await expect(element(by.id("agendaNextDay"))).toBeVisible();
  });

  it("should navigate between days", async () => {
    await waitForLoadingComplete();

    // Get current date header text
    const dateHeader = element(by.id("agendaDateHeader"));
    await expect(dateHeader).toBeVisible();

    // Navigate forward
    await element(by.id("agendaNextDay")).tap();

    // Navigate back
    await element(by.id("agendaPrevDay")).tap();

    // Should still be on agenda screen
    await expect(element(by.id("agendaScreen"))).toBeVisible();
  });

  it("should populate agenda with entries from API", async () => {
    await waitForLoadingComplete();

    // Test data is on today's date (2026-01-21): Team meeting, Doctor appointment, Submit report
    // Wait for agenda list to be visible
    await waitFor(element(by.id("agendaList")))
      .toBeVisible()
      .withTimeout(10000);

    // Wait for and verify entries are shown
    await waitFor(element(by.text("Team meeting")))
      .toBeVisible()
      .withTimeout(15000);
    // Verify Doctor appointment is also visible
    await expect(element(by.text("Doctor appointment"))).toBeVisible();

    // Verify TODO state is visible
    await expect(element(by.text("TODO")).atIndex(0)).toBeVisible();
  });

  it("should refresh when pulling down", async () => {
    await waitForLoadingComplete();
    // Test data is on today (2026-01-21), no need to navigate
    await waitFor(element(by.id("agendaList")))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id("agendaList")).swipe("down", "slow", 0.75);
    await expect(element(by.text("Team meeting"))).toBeVisible();
  });
});

describe("Agenda Screen - Tab Navigation", () => {
  beforeEach(async () => {
    await setupTestWithLogin();
  });

  it("should navigate to Search tab and back to Agenda", async () => {
    // Navigate to Search
    await navigateToTab("Search");
    // Wait for search screen to load (may show loading first)
    await waitFor(element(by.id("searchScreen")))
      .toBeVisible()
      .withTimeout(10000);

    // Navigate back to Agenda
    await navigateToTab("Agenda");
    await expect(element(by.id("agendaScreen"))).toBeVisible();
  });

  it("should preserve agenda data after tab switch", async () => {
    await waitForLoadingComplete();
    await element(by.id("agendaNextDay")).tap();
    await waitFor(element(by.text("Team meeting")))
      .toBeVisible()
      .withTimeout(10000);
    await navigateToTab("Search");
    await navigateToTab("Agenda");
    await expect(element(by.text("Team meeting"))).toBeVisible();
  });
});

describe("Agenda Screen - Todo Manipulation", () => {
  beforeEach(async () => {
    await setupTestWithLogin();
    await waitForLoadingComplete();
    // Test items are on today's date (2026-01-21): Team meeting, Doctor appointment, Submit report
    // Wait for the list container AND the data to load
    await waitFor(element(by.id("agendaList")))
      .toBeVisible()
      .withTimeout(10000);
    // Wait for a known test entry to appear (ensures data is loaded)
    await waitFor(element(by.text("Team meeting")))
      .toBeVisible()
      .withTimeout(15000);
  });

  it("should reveal swipe actions when swiping left on a todo", async () => {
    // Swipe left on the first todo item to reveal actions
    await element(by.text("Team meeting")).swipe("left", "fast", 0.5);

    // Should reveal Tomorrow, Schedule, Deadline, Priority buttons (use testIDs to avoid multiple matches)
    await expect(
      element(by.id("tomorrowActionButton_Team_meeting")),
    ).toBeVisible();
    await expect(
      element(by.id("scheduleActionButton_Team_meeting")),
    ).toBeVisible();
    await expect(
      element(by.id("deadlineActionButton_Team_meeting")),
    ).toBeVisible();
    await expect(
      element(by.id("priorityActionButton_Team_meeting")),
    ).toBeVisible();
  });

  it("should schedule todo for tomorrow using direct swipe action", async () => {
    // Verify the todo is visible before scheduling
    await expect(element(by.text("Team meeting"))).toBeVisible();

    // Swipe left on a todo to reveal actions
    await element(by.text("Team meeting")).swipe("left", "fast", 0.5);

    // Tap Tomorrow button using testID
    await element(by.id("tomorrowActionButton_Team_meeting")).tap();

    // Should see success snackbar
    await waitFor(element(by.text(/Scheduled for tomorrow:/)))
      .toBeVisible()
      .withTimeout(5000);

    // Item should be removed from current day's view
    await waitFor(element(by.text("Team meeting")))
      .not.toBeVisible()
      .withTimeout(5000);
  });

  it("should open schedule modal with date picker", async () => {
    // Swipe left on a todo to reveal actions
    await element(by.text("Submit report")).swipe("left", "fast", 0.5);

    // Tap Schedule button using testID
    await element(by.id("scheduleActionButton_Submit_report")).tap();

    // Modal should appear with title and buttons
    await expect(element(by.text("Set Schedule"))).toBeVisible();
    await expect(element(by.text("Save"))).toBeVisible();
    await expect(element(by.text("Cancel"))).toBeVisible();
    await expect(element(by.text("Clear"))).toBeVisible();
  });

  it("should schedule todo for next week using modal quick button", async () => {
    // Verify the todo is visible before scheduling
    await expect(element(by.text("Submit report"))).toBeVisible();

    // Swipe left on Submit report todo
    await element(by.text("Submit report")).swipe("left", "fast", 0.5);

    // Tap Schedule button using testID to open modal
    await element(by.id("scheduleActionButton_Submit_report")).tap();

    // Wait for modal
    await expect(element(by.text("Set Schedule"))).toBeVisible();

    // Tap Next Week button in modal
    await element(by.text("Next Week")).tap();

    // Should see success snackbar
    await waitFor(element(by.text(/Updated:/)))
      .toBeVisible()
      .withTimeout(5000);

    // Item should be removed from current day's view (scheduled to different day)
    await waitFor(element(by.text("Submit report")))
      .not.toBeVisible()
      .withTimeout(5000);
  });

  it("should change todo state by tapping state chip", async () => {
    // Tap on the TODO chip of a todo item
    await element(by.text("TODO")).atIndex(0).tap();

    // State modal should appear
    await expect(element(by.text("Change State"))).toBeVisible();

    // Should see state options
    await expect(element(by.text("DONE"))).toBeVisible();
  });

  it("should delete item via detail view", async () => {
    // beforeEach already navigated to tomorrow where Doctor appointment is scheduled
    // Wait for the item to be visible (data may still be loading after navigation)
    await waitFor(element(by.text("Doctor appointment")))
      .toBeVisible()
      .withTimeout(15000);

    // Tap on item to open detail view
    await element(by.text("Doctor appointment")).tap();

    // Wait for edit screen to appear with delete button
    await waitFor(element(by.id("delete-button")))
      .toBeVisible()
      .withTimeout(5000);

    // Tap delete button
    await element(by.id("delete-button")).tap();

    // Confirmation dialog should appear
    await waitFor(element(by.text("Delete Todo?")))
      .toBeVisible()
      .withTimeout(5000);

    // Confirm deletion
    await element(by.text("Delete")).tap();

    // Wait for dialog to dismiss
    await waitFor(element(by.text("Delete Todo?")))
      .not.toBeVisible()
      .withTimeout(5000);

    // Wait for edit screen to close (delete button should no longer be visible)
    await waitFor(element(by.id("delete-button")))
      .not.toBeVisible()
      .withTimeout(10000);

    // Should be back on agenda screen and item should be gone
    await waitFor(element(by.id("agendaScreen")))
      .toBeVisible()
      .withTimeout(15000);
    await waitFor(element(by.text("Doctor appointment")))
      .not.toBeVisible()
      .withTimeout(10000);
  });
});
