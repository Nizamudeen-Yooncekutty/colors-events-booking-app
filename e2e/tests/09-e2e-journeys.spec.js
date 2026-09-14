const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth');
const { apiGetToken, apiGet, apiPost, apiDelete, getEvents } = require('../helpers/api');

test.describe('TS-009: End-to-End User Journeys', () => {

  test('TC-111: Employee full journey - Login > Browse > View Detail > My Bookings > QR Pass', async ({ page }) => {
    // Step 1: Login
    await loginAs(page, 'employee');
    await expect(page).toHaveURL(/\/events/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-111-step1-login.png' });

    // Step 2: Browse events
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toMatch(/Diwali|Onam|Christmas/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-111-step2-browse.png' });

    // Step 3: Click event to view detail
    const eventCard = page.locator('[class*="card"], [role="button"]').filter({ hasText: /Diwali/i }).first();
    await eventCard.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-111-step3-detail.png' });

    // Step 4: Go to my bookings
    await page.goto('/my-bookings');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-111-step4-mybookings.png' });

    // Step 5: View QR pass
    const viewPass = page.locator('a, button').filter({ hasText: /View Pass|View QR/i }).first();
    if (await viewPass.isVisible()) {
      await viewPass.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'e2e/reports/screenshots/TC-111-step5-qrpass.png' });
    }
  });

  test('TC-112: Admin full journey - Dashboard > Create Event > Edit > Report > Delete', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');

    // Step 1: Dashboard
    const dashRes = await apiGet(request, '/admin/dashboard', token);
    expect(dashRes.status()).toBe(200);

    // Step 2: Create event
    const createRes = await apiPost(request, '/events', token, {
      title: 'E2E Journey Test Event',
      eventDate: '2027-09-01T00:00:00.000Z',
      venue: 'Journey Test Hall',
      registrationStart: '2027-08-01T00:00:00.000Z',
      registrationEnd: '2027-08-31T00:00:00.000Z',
      maxCapacity: 50,
      status: 'active',
      foodOptions: [{ name: 'Veg' }],
    });
    expect(createRes.status()).toBe(201);
    const event = await createRes.json();

    // Step 3: Edit event
    const editRes = await request.put(`/api/events/${event._id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'E2E Journey Test Event (Edited)', maxCapacity: 100 },
    });
    expect(editRes.status()).toBe(200);

    // Step 4: Get report
    const reportRes = await apiGet(request, `/admin/events/${event._id}/report`, token);
    expect(reportRes.status()).toBe(200);

    // Step 5: Download CSV
    const csvRes = await apiGet(request, `/admin/events/${event._id}/report/download`, token);
    expect(csvRes.status()).toBe(200);

    // Step 6: Delete event
    const delRes = await request.delete(`/api/events/${event._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.status()).toBe(200);
  });

  test('TC-113: Volunteer journey - Login > Scanner > Walk-in registration (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');

    // Step 1: Get events
    const events = await getEvents(request, token);
    const active = events.find(e => e.status === 'active' && e.title.includes('Christmas'));

    if (active) {
      // Step 2: Register a walk-in guest
      const walkinRes = await apiPost(request, '/walkins', token, {
        eventId: active._id,
        attendeeType: 'guest',
        name: 'Journey Test Guest',
        phone: '1111111111',
      });
      expect(walkinRes.status()).toBe(201);

      // Step 3: Get walk-in list
      const listRes = await apiGet(request, `/walkins/event/${active._id}`, token);
      expect(listRes.status()).toBe(200);
      const { walkIns, stats } = await listRes.json();
      expect(walkIns.length).toBeGreaterThan(0);
      expect(stats.total).toBeGreaterThan(0);

      // Step 4: Get walk-in QR codes
      const qrRes = await apiGet(request, `/walkins/event/${active._id}/qrcodes`, token);
      expect(qrRes.status()).toBe(200);
    }
  });

  test('TC-114: Booking + Check-in + Report journey (API)', async ({ request }) => {
    const adminToken = await apiGetToken(request, 'ADMIN001', 'admin123');
    const empToken = await apiGetToken(request, 'EMP015', 'emp123');
    const volToken = await apiGetToken(request, 'VOL001', 'vol123');

    // Step 1: Find Christmas event (no bookings yet for EMP015)
    const events = await getEvents(request, empToken);
    const christmas = events.find(e => e.title.includes('Christmas'));
    if (!christmas) return;

    // Step 2: Employee books
    const bookRes = await apiPost(request, '/bookings', empToken, {
      eventId: christmas._id,
      foodPreference: 'Vegetarian',
    });
    if (bookRes.status() !== 201) return; // may already be booked

    const booking = await bookRes.json();

    // Step 3: Volunteer checks in via QR scan
    const scanRes = await apiPost(request, '/bookings/scan', volToken, {
      qrData: booking.qrData,
    });
    expect(scanRes.status()).toBe(200);
    const scanBody = await scanRes.json();
    expect(scanBody.valid).toBe(true);

    // Step 4: Second scan returns already checked in
    const scan2 = await apiPost(request, '/bookings/scan', volToken, {
      qrData: booking.qrData,
    });
    expect(scan2.status()).toBe(400);

    // Step 5: Admin views report
    const reportRes = await apiGet(request, `/admin/events/${christmas._id}/report`, adminToken);
    expect(reportRes.status()).toBe(200);
    const report = await reportRes.json();
    expect(report.classification.employees.checkedIn).toBeGreaterThan(0);
  });

  test('TC-115: Role management journey - Add role > SSO sync check (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');

    // Add a role user
    const addRes = await apiPost(request, '/admin/role-users', token, {
      email: 'journey-test@ust.com',
      role: 'volunteer',
      name: 'Journey Tester',
    });
    expect([200, 201]).toContain(addRes.status());

    // Update to admin
    const updateRes = await apiPost(request, '/admin/role-users', token, {
      email: 'journey-test@ust.com',
      role: 'admin',
    });
    expect(updateRes.status()).toBe(200);

    // Remove
    const listRes = await apiGet(request, '/admin/role-users', token);
    const { roleUsers } = await listRes.json();
    const testUser = roleUsers.find(r => r.email === 'journey-test@ust.com');
    if (testUser) {
      const delRes = await request.delete(`/api/admin/role-users/${testUser._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(delRes.status()).toBe(200);
    }
  });

  test('TC-116: Navigation guard journey (UI)', async ({ page }) => {
    // Unauthenticated -> login
    await page.goto('/events');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-116-step1-unauth.png' });

    // Login as employee
    await loginAs(page, 'employee');

    // Try admin -> redirected
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/\/admin/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-116-step2-no-admin.png' });

    // Try scanner -> redirected
    await page.goto('/scanner');
    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/\/scanner/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-116-step3-no-scanner.png' });

    // Unknown route -> events
    await page.goto('/xyz');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/events/);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-116-step4-unknown.png' });
  });

  test('TC-117: Admin manages bookings for event (UI)', async ({ page }) => {
    await loginAs(page, 'admin');
    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    const eventsRes = await page.request.get('/api/events', { headers: { Authorization: `Bearer ${token}` } });
    const eventsBody = await eventsRes.json();
    const events = eventsBody.events || eventsBody;
    const diwali = events.find(e => e.title.includes('Diwali'));

    if (diwali) {
      await page.goto(`/admin/events/${diwali._id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Verify bookings table visible
      const body = await page.textContent('body');
      expect(body).toMatch(/Arun|Sneha|Vikram|Employee/i);
      await page.screenshot({ path: 'e2e/reports/screenshots/TC-117-admin-bookings.png', fullPage: true });

      // Switch to walk-ins view
      const walkinTab = page.locator('button, [role="tab"]').filter({ hasText: /Walk-in/i }).first();
      if (await walkinTab.isVisible()) {
        await walkinTab.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'e2e/reports/screenshots/TC-117-admin-walkins.png', fullPage: true });
      }
    }
  });
});
