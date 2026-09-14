const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth');
const { apiGetToken, apiGet, apiPost, apiPut, apiDelete, getEvents } = require('../helpers/api');

test.describe('TS-006: Admin Event Management', () => {

  test('TC-066: Admin dashboard loads with stats', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toMatch(/Total|Employees|Events|Bookings|Attended/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-066-admin-dashboard.png', fullPage: true });
  });

  test('TC-067: Admin dashboard shows recent events', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toMatch(/Diwali|Onam|Christmas|Independence/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-067-recent-events.png', fullPage: true });
  });

  test('TC-068: Create event page loads', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/create-event');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toMatch(/Create|Event|Title|Venue|Date/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-068-create-event-page.png', fullPage: true });
  });

  test('TC-069: Create event via API', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiPost(request, '/events', token, {
      title: 'E2E Test Event',
      description: 'Automated test event',
      eventDate: '2027-06-15T00:00:00.000Z',
      venue: 'Test Venue Hall',
      registrationStart: '2027-05-01T00:00:00.000Z',
      registrationEnd: '2027-06-14T00:00:00.000Z',
      maxCapacity: 100,
      status: 'draft',
      foodOptions: [{ name: 'Veg' }, { name: 'Non-Veg' }],
      timeSlots: [{ label: 'Slot A', startTime: '10:00', endTime: '12:00', maxCapacity: 50 }],
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('E2E Test Event');
  });

  test('TC-070: Update event via API', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const events = await getEvents(request, token);
    const testEvent = events.find(e => e.title === 'E2E Test Event');
    if (testEvent) {
      const res = await apiPut(request, `/events/${testEvent._id}`, token, {
        title: 'E2E Test Event Updated',
        maxCapacity: 200,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.title).toBe('E2E Test Event Updated');
    }
  });

  test('TC-071: Employee cannot create events (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP001', 'emp123');
    const res = await apiPost(request, '/events', token, {
      title: 'Unauthorized Event',
      eventDate: '2027-01-01T00:00:00.000Z',
      venue: 'Nowhere',
      registrationStart: '2026-12-01T00:00:00.000Z',
      registrationEnd: '2026-12-31T00:00:00.000Z',
    });
    expect(res.status()).toBe(403);
  });

  test('TC-072: Volunteer cannot create events (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');
    const res = await apiPost(request, '/events', token, {
      title: 'Unauthorized Event',
      eventDate: '2027-01-01T00:00:00.000Z',
      venue: 'Nowhere',
      registrationStart: '2026-12-01T00:00:00.000Z',
      registrationEnd: '2026-12-31T00:00:00.000Z',
    });
    expect(res.status()).toBe(403);
  });

  test('TC-073: Create event with missing required fields rejected (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiPost(request, '/events', token, {
      title: 'Missing Fields Event',
    });
    expect([400, 500]).toContain(res.status());
  });

  test('TC-074: Delete event via API', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const events = await getEvents(request, token);
    const testEvent = events.find(e => e.title.includes('E2E Test Event'));
    if (testEvent) {
      const res = await apiDelete(request, `/events/${testEvent._id}`, token);
      expect(res.status()).toBe(200);
    }
  });

  test('TC-075: Admin event page shows bookings and walk-ins', async ({ page }) => {
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
      const body = await page.textContent('body');
      expect(body).toMatch(/Booking|Check|Walk-in|Employee/i);
      await page.screenshot({ path: 'e2e/reports/screenshots/TC-075-admin-event-page.png', fullPage: true });
    }
  });

  test('TC-076: Edit event page loads with pre-filled data', async ({ page }) => {
    await loginAs(page, 'admin');
    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    const eventsRes = await page.request.get('/api/events', { headers: { Authorization: `Bearer ${token}` } });
    const eventsBody = await eventsRes.json();
    const events = eventsBody.events || eventsBody;
    const diwali = events.find(e => e.title.includes('Diwali'));
    if (diwali) {
      await page.goto(`/admin/events/${diwali._id}/edit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const titleInput = page.locator('input[name="title"], input[placeholder*="Title" i]').first();
      const value = await titleInput.inputValue();
      expect(value).toContain('Diwali');
      await page.screenshot({ path: 'e2e/reports/screenshots/TC-076-edit-event.png', fullPage: true });
    }
  });

  test('TC-077: Event report page shows classification and charts', async ({ page }) => {
    await loginAs(page, 'admin');
    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    const eventsRes = await page.request.get('/api/events', { headers: { Authorization: `Bearer ${token}` } });
    const eventsBody = await eventsRes.json();
    const events = eventsBody.events || eventsBody;
    const diwali = events.find(e => e.title.includes('Diwali'));
    if (diwali) {
      await page.goto(`/admin/events/${diwali._id}/report`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      expect(body).toMatch(/Registration|Check-in|Walk-in|Attended|Classification|Food/i);
      await page.screenshot({ path: 'e2e/reports/screenshots/TC-077-event-report.png', fullPage: true });
    }
  });

  test('TC-078: CSV report download (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const events = await getEvents(request, token);
    const diwali = events.find(e => e.title.includes('Diwali'));
    if (diwali) {
      const res = await apiGet(request, `/admin/events/${diwali._id}/report/download`, token);
      expect(res.status()).toBe(200);
      const headers = res.headers();
      expect(headers['content-type']).toContain('text/csv');
      const text = await res.text();
      expect(text).toContain('Name');
      expect(text).toContain('Employee');
    }
  });

  test('TC-079: Employee cannot access event report (API)', async ({ request }) => {
    const adminToken = await apiGetToken(request, 'ADMIN001', 'admin123');
    const empToken = await apiGetToken(request, 'EMP001', 'emp123');
    const events = await getEvents(request, adminToken);
    const diwali = events.find(e => e.title.includes('Diwali'));
    if (diwali) {
      const res = await apiGet(request, `/admin/events/${diwali._id}/report`, empToken);
      expect(res.status()).toBe(403);
    }
  });

  test('TC-080: Admin dashboard stats API', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiGet(request, '/admin/dashboard', token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.stats.totalEmployees).toBeGreaterThan(0);
    expect(body.stats.totalEvents).toBeGreaterThan(0);
    expect(body.recentEvents.length).toBeGreaterThan(0);
  });

  test('TC-081: Employee cannot access admin dashboard (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP001', 'emp123');
    const res = await apiGet(request, '/admin/dashboard', token);
    expect(res.status()).toBe(403);
  });
});
