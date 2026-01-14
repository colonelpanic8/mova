/**
 * Search Screen Population E2E Tests
 *
 * Tests that the search/todos page populates correctly with data from the API.
 * Uses test container with known test data.
 */

import { by, element, expect, waitFor } from 'detox';
import { setupTestWithLogin, navigateToTab } from './helpers/test-helpers';

describe('Search Screen Population', () => {
  beforeEach(async () => {
    // Every test starts fresh with a new app instance and login
    await setupTestWithLogin();
  });

  it('should navigate to search screen', async () => {
    await navigateToTab('Search');
    await expect(element(by.id('searchScreen'))).toBeVisible();
  });

  it('should populate with todos from API', async () => {
    await navigateToTab('Search');

    // Wait for the list to load
    await waitFor(element(by.id('searchScreen')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify test data items are visible
    // These come from e2e/test-data/*.org files
    await waitFor(element(by.text('Team meeting')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should display multiple todos', async () => {
    await navigateToTab('Search');

    await waitFor(element(by.text('Team meeting')))
      .toBeVisible()
      .withTimeout(10000);

    // More items from test data
    await expect(element(by.text('Submit report'))).toBeVisible();
    await expect(element(by.text('Doctor appointment'))).toBeVisible();
  });

  it('should show todo states', async () => {
    await navigateToTab('Search');

    await waitFor(element(by.text('Team meeting')))
      .toBeVisible()
      .withTimeout(10000);

    // All test items have TODO state
    await expect(element(by.text('TODO')).atIndex(0)).toBeVisible();
  });

  it('should allow searching/filtering todos', async () => {
    await navigateToTab('Search');

    await waitFor(element(by.text('Team meeting')))
      .toBeVisible()
      .withTimeout(10000);

    // Type in search box
    await element(by.id('searchInput')).typeText('meeting');

    // Should show filtered results
    await expect(element(by.text('Team meeting'))).toBeVisible();
  });
});
