const { test, expect } = require('@playwright/test');
const { loginAs, USERS } = require('../helpers/auth');

test.describe('TS-001: Authentication', () => {

  test('TC-001: Login with valid admin credentials', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page).toHaveURL(/\/(admin|events)/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-001-admin-login.png', fullPage: true });
  });

  test('TC-002: Login with valid employee credentials', async ({ page }) => {
    await loginAs(page, 'employee');
    await expect(page).toHaveURL(/\/events/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-002-employee-login.png', fullPage: true });
  });

  test('TC-003: Login with valid volunteer credentials', async ({ page }) => {
    await loginAs(page, 'volunteer');
    await expect(page).toHaveURL(/\/events/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-003-volunteer-login.png', fullPage: true });
  });

  test('TC-004: Login with invalid password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"], input[placeholder*="Employee" i], input[name="employeeId"]', 'ADMIN001').catch(async () => {
      await page.locator('input').first().fill('ADMIN001');
    });
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const errorText = await page.textContent('body');
    expect(errorText.toLowerCase()).toMatch(/invalid|failed|error|incorrect/);
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-004-invalid-password.png', fullPage: true });
  });

  test('TC-005: Login with non-existent employee ID', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"], input[placeholder*="Employee" i], input[name="employeeId"]', 'FAKE999').catch(async () => {
      await page.locator('input').first().fill('FAKE999');
    });
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-005-nonexistent-user.png', fullPage: true });
  });

  test('TC-006: Login with empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-006-empty-fields.png', fullPage: true });
  });

  test('TC-007: Authenticated user redirected from login page', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/login');
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-007-redirect-from-login.png', fullPage: true });
  });

  test('TC-008: Logout clears session', async ({ page }) => {
    await loginAs(page, 'employee');
    const signOutBtn = page.locator('text=Sign Out').or(page.locator('text=Logout'));
    if (await signOutBtn.count() > 0) {
      await signOutBtn.first().click();
    } else {
      const profileBtn = page.locator('[class*="avatar"], [class*="profile"], button:has(svg)').last();
      await profileBtn.click();
      await page.click('text=Sign Out');
    }
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/login/);
    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    expect(token).toBeNull();
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-008-logout.png', fullPage: true });
  });

  test('TC-009: Unauthenticated access to /events redirects to login', async ({ page }) => {
    await page.goto('/events');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-009-unauth-redirect.png', fullPage: true });
  });

  test('TC-010: Unauthenticated access to /admin redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-010-unauth-admin.png', fullPage: true });
  });

  test('TC-011: Unauthenticated access to /scanner redirects to login', async ({ page }) => {
    await page.goto('/scanner');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-011-unauth-scanner.png', fullPage: true });
  });

  test('TC-012: Employee cannot access /admin', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/\/admin/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-012-employee-no-admin.png', fullPage: true });
  });

  test('TC-013: Employee cannot access /scanner', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/scanner');
    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/\/scanner/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-013-employee-no-scanner.png', fullPage: true });
  });

  test('TC-014: Volunteer cannot access /admin', async ({ page }) => {
    await loginAs(page, 'volunteer');
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/\/admin/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-014-volunteer-no-admin.png', fullPage: true });
  });

  test('TC-015: Volunteer can access /scanner', async ({ page }) => {
    await loginAs(page, 'volunteer');
    await page.goto('/scanner');
    await expect(page).toHaveURL(/\/scanner/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-015-volunteer-scanner.png', fullPage: true });
  });
});
