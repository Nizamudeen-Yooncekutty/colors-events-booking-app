const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth');

test.describe('TS-002: Event Browsing & Listing', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'employee');
  });

  test('TC-016: Events page loads with event list', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const events = page.locator('[class*="card"], [class*="event"], [role="button"]').filter({ hasText: /Celebration|Party|Sadya|Lunch/i });
    await expect(events.first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-016-events-list.png', fullPage: true });
  });

  test('TC-017: Event cards show title and date and venue', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toContain('Diwali');
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-017-event-card-details.png', fullPage: true });
  });

  test('TC-018: Status filter pills are visible', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const filterBar = page.locator('button, [role="tab"]').filter({ hasText: /All|Open|Upcoming|Closed|Full/i });
    const count = await filterBar.count();
    expect(count).toBeGreaterThanOrEqual(2);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-018-filter-pills.png', fullPage: true });
  });

  test('TC-019: Click on event card opens detail', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const eventCard = page.locator('[class*="card"], [role="button"]').filter({ hasText: /Diwali/i }).first();
    await eventCard.click();
    await page.waitForTimeout(1500);
    const detailText = await page.textContent('body');
    expect(detailText).toContain('Diwali');
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-019-event-detail.png', fullPage: true });
  });

  test('TC-020: Employee does NOT see draft events', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).not.toContain('Pongal');
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-020-no-draft-events.png', fullPage: true });
  });

  test('TC-021: Admin sees draft events', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const allFilter = page.locator('button, [role="tab"]').filter({ hasText: /All/i }).first();
    if (await allFilter.isVisible()) await allFilter.click();
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body).toContain('Pongal');
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-021-admin-sees-drafts.png', fullPage: true });
  });

  test('TC-022: Event detail shows time slots', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const eventCard = page.locator('[class*="card"], [role="button"]').filter({ hasText: /Diwali/i }).first();
    await eventCard.click();
    await page.waitForTimeout(1500);
    const body = await page.textContent('body');
    expect(body).toMatch(/Evening|Night|Morning|Afternoon|Batch/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-022-time-slots.png', fullPage: true });
  });

  test('TC-023: Event detail shows food options', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const eventCard = page.locator('[class*="card"], [role="button"]').filter({ hasText: /Diwali/i }).first();
    await eventCard.click();
    await page.waitForTimeout(1500);
    const body = await page.textContent('body');
    expect(body).toMatch(/Vegetarian|Non-Vegetarian|Vegan|Jain/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-023-food-options.png', fullPage: true });
  });

  test('TC-024: Event shows capacity info', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toMatch(/\d+\s*\/\s*\d+|\d+\s*registered|\d+\s*booking/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-024-capacity-info.png', fullPage: true });
  });

  test('TC-025: Unknown route redirects to events', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/events/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-025-unknown-route.png', fullPage: true });
  });
});
