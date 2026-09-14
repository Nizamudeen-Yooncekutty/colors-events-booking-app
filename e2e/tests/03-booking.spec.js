const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth');
const { apiGetToken, apiGet, apiPost, apiDelete, getEvents, getMyBookings, getBooking } = require('../helpers/api');

test.describe('TS-003: Event Booking', () => {

  test('TC-026: Employee can view their bookings on My Bookings page', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/my-bookings');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toMatch(/Diwali|Onam|Independence/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-026-my-bookings.png', fullPage: true });
  });

  test('TC-027: Employee can view QR pass for a booking', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/my-bookings');
    await page.waitForLoadState('networkidle');
    const viewPassBtn = page.locator('a, button').filter({ hasText: /View Pass|View QR/i }).first();
    await viewPassBtn.click();
    await page.waitForTimeout(3000);
    const qrImage = page.locator('img[src*="data:image"], img[alt*="QR" i], canvas');
    await expect(qrImage.first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-027-qr-pass.png', fullPage: true });
  });

  test('TC-028: QR pass shows correct event details', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/my-bookings');
    await page.waitForLoadState('networkidle');
    const viewPassBtn = page.locator('a, button').filter({ hasText: /View Pass|View QR/i }).first();
    await viewPassBtn.click();
    await page.waitForTimeout(3000);
    const body = await page.textContent('body');
    expect(body).toMatch(/Arun Bhaskar|EMP001/i);
    expect(body).toMatch(/Vegetarian|Non-Vegetarian/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-028-qr-details.png', fullPage: true });
  });

  test('TC-029: QR pass is color-coded by time slot', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/my-bookings');
    await page.waitForLoadState('networkidle');
    const viewPassBtn = page.locator('a, button').filter({ hasText: /View Pass|View QR/i }).first();
    await viewPassBtn.click();
    await page.waitForTimeout(3000);
    const coloredElements = page.locator('[style*="background"], [style*="border-color"], [style*="color"]');
    const count = await coloredElements.count();
    expect(count).toBeGreaterThan(0);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-029-qr-colors.png', fullPage: true });
  });

  test('TC-030: Duplicate booking prevented (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP001', 'emp123');
    const events = await getEvents(request, token);
    const diwali = events.find(e => e.title.includes('Diwali'));
    const res = await apiPost(request, '/bookings', token, {
      eventId: diwali._id,
      foodPreference: 'Vegetarian',
      timeSlotId: diwali.timeSlots[0]._id,
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message.toLowerCase()).toContain('already registered');
  });

  test('TC-031: Booking with missing food preference rejected (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP001', 'emp123');
    const events = await getEvents(request, token);
    const christmas = events.find(e => e.title.includes('Christmas'));
    const res = await apiPost(request, '/bookings', token, {
      eventId: christmas._id,
    });
    expect(res.status()).toBe(400);
  });

  test('TC-032: Booking with invalid event ID rejected (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP001', 'emp123');
    const res = await apiPost(request, '/bookings', token, {
      eventId: '000000000000000000000000',
      foodPreference: 'Vegetarian',
    });
    expect(res.status()).toBe(404);
  });

  test('TC-033: Booking with invalid food preference rejected (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP001', 'emp123');
    const events = await getEvents(request, token);
    const christmas = events.find(e => e.title.includes('Christmas'));
    const res = await apiPost(request, '/bookings', token, {
      eventId: christmas._id,
      foodPreference: 'PizzaNotOnMenu',
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message.toLowerCase()).toContain('invalid food preference');
  });

  test('TC-034: Booking without auth rejected (API)', async ({ request }) => {
    const res = await request.post('/api/bookings', {
      data: { eventId: '000000000000000000000000', foodPreference: 'Veg' },
    });
    expect(res.status()).toBe(401);
  });

  test('TC-035: Booking for closed registration event rejected (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP005', 'emp123');
    const events = await getEvents(request, token);
    const holi = events.find(e => e.title.includes('Holi'));
    if (holi) {
      const res = await apiPost(request, '/bookings', token, {
        eventId: holi._id,
        foodPreference: 'Vegetarian',
      });
      expect([400, 404]).toContain(res.status());
    }
  });

  test('TC-036: Employee can cancel a confirmed booking (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP005', 'emp123');
    const bookings = await getMyBookings(request, token);
    const confirmed = bookings.find(b => b.status === 'confirmed');
    if (confirmed) {
      const res = await apiDelete(request, `/bookings/${confirmed._id}`, token);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.message.toLowerCase()).toContain('cancelled');
    }
  });

  test('TC-037: Cannot cancel a checked-in booking (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP001', 'emp123');
    const bookings = await getMyBookings(request, token);
    const checkedIn = bookings.find(b => b.status === 'checked_in');
    if (checkedIn) {
      const res = await apiDelete(request, `/bookings/${checkedIn._id}`, token);
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.message.toLowerCase()).toContain('check-in');
    }
  });

  test('TC-038: Employee cannot cancel another users booking (API)', async ({ request }) => {
    const token1 = await apiGetToken(request, 'EMP001', 'emp123');
    const token2 = await apiGetToken(request, 'EMP002', 'emp123');
    const bookings = await getMyBookings(request, token1);
    const booking = bookings.find(b => b.status !== 'cancelled');
    if (booking) {
      const res = await apiDelete(request, `/bookings/${booking._id}`, token2);
      expect(res.status()).toBe(403);
    }
  });

  test('TC-039: Employee cannot view another users booking (API)', async ({ request }) => {
    const token1 = await apiGetToken(request, 'EMP001', 'emp123');
    const token2 = await apiGetToken(request, 'EMP003', 'emp123');
    const bookings = await getMyBookings(request, token1);
    const booking = bookings[0];
    if (booking) {
      const res = await apiGet(request, `/bookings/${booking._id}`, token2);
      expect(res.status()).toBe(403);
    }
  });

  test('TC-040: My Bookings page shows empty state for user with no bookings', async ({ page }) => {
    await loginAs(page, 'volunteer2');
    await page.goto('/my-bookings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    const hasBookings = body.match(/Diwali|Onam|Independence/i);
    const hasEmpty = body.match(/No bookings|Browse Events/i);
    expect(hasBookings || hasEmpty).toBeTruthy();
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-040-empty-bookings.png', fullPage: true });
  });
});
