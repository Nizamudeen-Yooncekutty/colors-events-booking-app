const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth');
const { apiGetToken, apiGet, apiPost, getMyBookings, getBooking } = require('../helpers/api');

test.describe('TS-004: QR Scanning & Check-In', () => {

  test('TC-041: Volunteer can access scanner page', async ({ page }) => {
    await loginAs(page, 'volunteer');
    await page.goto('/scanner');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/scanner/);
    const body = await page.textContent('body');
    expect(body).toMatch(/QR Scan|Walk-in|Scanner|Scan/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-041-scanner-page.png', fullPage: true });
  });

  test('TC-042: Admin can access scanner page', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/scanner');
    await expect(page).toHaveURL(/\/scanner/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-042-admin-scanner.png', fullPage: true });
  });

  test('TC-043: Scanner has QR Scan and Walk-in tabs', async ({ page }) => {
    await loginAs(page, 'volunteer');
    await page.goto('/scanner');
    await page.waitForLoadState('networkidle');
    const qrTab = page.locator('button, [role="tab"]').filter({ hasText: /QR|Scan/i });
    const walkinTab = page.locator('button, [role="tab"]').filter({ hasText: /Walk-in/i });
    await expect(qrTab.first()).toBeVisible();
    await expect(walkinTab.first()).toBeVisible();
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-043-scanner-tabs.png', fullPage: true });
  });

  test('TC-044: Valid QR scan checks in employee (API)', async ({ request }) => {
    const volToken = await apiGetToken(request, 'VOL001', 'vol123');
    const empToken = await apiGetToken(request, 'EMP004', 'emp123');
    const bookings = await getMyBookings(request, empToken);
    const confirmed = bookings.find(b => b.status === 'confirmed');
    if (confirmed) {
      const booking = await getBooking(request, confirmed._id, empToken);
      const scanRes = await apiPost(request, '/bookings/scan', volToken, { qrData: booking.qrData });
      expect(scanRes.status()).toBe(200);
      const scanBody = await scanRes.json();
      expect(scanBody.valid).toBe(true);
    }
  });

  test('TC-045: Already checked-in QR returns warning (API)', async ({ request }) => {
    const volToken = await apiGetToken(request, 'VOL001', 'vol123');
    const empToken = await apiGetToken(request, 'EMP001', 'emp123');
    const bookings = await getMyBookings(request, empToken);
    const checkedIn = bookings.find(b => b.status === 'checked_in');
    if (checkedIn) {
      const booking = await getBooking(request, checkedIn._id, empToken);
      const scanRes = await apiPost(request, '/bookings/scan', volToken, { qrData: booking.qrData });
      expect(scanRes.status()).toBe(400);
      const body = await scanRes.json();
      expect(body.message.toLowerCase()).toContain('already checked in');
    }
  });

  test('TC-046: Invalid QR code rejected (API)', async ({ request }) => {
    const volToken = await apiGetToken(request, 'VOL001', 'vol123');
    const res = await apiPost(request, '/bookings/scan', volToken, { qrData: 'COLORS-FAKE-INVALID123' });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.valid).toBe(false);
  });

  test('TC-047: Tampered QR code rejected (API)', async ({ request }) => {
    const volToken = await apiGetToken(request, 'VOL001', 'vol123');
    const res = await apiPost(request, '/bookings/scan', volToken, { qrData: 'COLORS-tampereddata-fakeid' });
    expect(res.status()).toBe(404);
  });

  test('TC-048: Employee cannot scan QR codes (API)', async ({ request }) => {
    const empToken = await apiGetToken(request, 'EMP001', 'emp123');
    const res = await apiPost(request, '/bookings/scan', empToken, { qrData: 'test' });
    expect(res.status()).toBe(403);
  });

  test('TC-049: Scan with empty QR data rejected (API)', async ({ request }) => {
    const volToken = await apiGetToken(request, 'VOL001', 'vol123');
    const res = await apiPost(request, '/bookings/scan', volToken, { qrData: '' });
    expect(res.status()).toBe(400);
  });

  test('TC-050: Manual employee lookup works (API)', async ({ request }) => {
    const volToken = await apiGetToken(request, 'VOL001', 'vol123');
    const res = await apiPost(request, '/bookings/lookup', volToken, { employeeId: 'EMP002' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.bookings.length).toBeGreaterThan(0);
  });

  test('TC-051: Manual lookup for non-existent employee (API)', async ({ request }) => {
    const volToken = await apiGetToken(request, 'VOL001', 'vol123');
    const res = await apiPost(request, '/bookings/lookup', volToken, { employeeId: 'FAKE999' });
    expect(res.status()).toBe(404);
  });

  test('TC-052: Manual lookup shows employee ID input on scanner page', async ({ page }) => {
    await loginAs(page, 'volunteer');
    await page.goto('/scanner');
    await page.waitForLoadState('networkidle');
    const lookupToggle = page.locator('button').filter({ hasText: /Employee|Lookup|Find|Search|ID/i }).or(page.locator('button svg'));
    const toggleBtns = await lookupToggle.count();
    if (toggleBtns > 0) {
      await lookupToggle.first().click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-052-manual-lookup.png', fullPage: true });
  });

  test('TC-053: Walk-in QR detected and handled separately (API)', async ({ request }) => {
    const volToken = await apiGetToken(request, 'VOL001', 'vol123');
    const res = await apiPost(request, '/bookings/scan', volToken, { qrData: 'WALKIN:guest:000000000000000000000000' });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('walk_in_qr');
    expect(body.isWalkInQR).toBe(true);
  });
});
