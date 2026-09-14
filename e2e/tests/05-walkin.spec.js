const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth');
const { apiGetToken, apiGet, apiPost, getEvents } = require('../helpers/api');

test.describe('TS-005: Walk-In Registration', () => {

  test('TC-054: Register guest walk-in (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');
    const events = await getEvents(request, token);
    const active = events.find(e => e.status === 'active' && e.title.includes('Christmas'));
    if (active) {
      const res = await apiPost(request, '/walkins', token, {
        eventId: active._id,
        attendeeType: 'guest',
        name: 'E2E Test Guest',
        phone: '9876543210',
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.message).toContain('checked in');
    }
  });

  test('TC-055: Register staff walk-in (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');
    const events = await getEvents(request, token);
    const active = events.find(e => e.status === 'active' && e.title.includes('Christmas'));
    if (active) {
      const res = await apiPost(request, '/walkins', token, {
        eventId: active._id,
        attendeeType: 'staff',
        name: 'E2E Test Staff',
      });
      expect(res.status()).toBe(201);
    }
  });

  test('TC-056: Register housekeeping walk-in (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');
    const events = await getEvents(request, token);
    const active = events.find(e => e.status === 'active' && e.title.includes('Christmas'));
    if (active) {
      const res = await apiPost(request, '/walkins', token, {
        eventId: active._id,
        attendeeType: 'housekeeping',
        name: 'E2E HK Staff',
      });
      expect(res.status()).toBe(201);
    }
  });

  test('TC-057: Register unregistered employee walk-in (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');
    const events = await getEvents(request, token);
    const active = events.find(e => e.status === 'active' && e.title.includes('Christmas'));
    if (active) {
      const res = await apiPost(request, '/walkins', token, {
        eventId: active._id,
        attendeeType: 'unregistered_employee',
        name: 'E2E Unreg Emp',
        employeeId: 'UNREG999',
        department: 'Testing',
      });
      expect(res.status()).toBe(201);
    }
  });

  test('TC-058: Walk-in with invalid attendee type rejected (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');
    const events = await getEvents(request, token);
    const active = events.find(e => e.status === 'active');
    const res = await apiPost(request, '/walkins', token, {
      eventId: active._id,
      attendeeType: 'invalid_type',
      name: 'Test',
    });
    expect(res.status()).toBe(400);
  });

  test('TC-059: Walk-in with invalid event ID rejected (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');
    const res = await apiPost(request, '/walkins', token, {
      eventId: '000000000000000000000000',
      attendeeType: 'guest',
      name: 'Test',
    });
    expect(res.status()).toBe(404);
  });

  test('TC-060: Walk-in without auth rejected (API)', async ({ request }) => {
    const res = await request.post('/api/walkins', {
      data: { eventId: '000000000000000000000000', attendeeType: 'guest', name: 'Test' },
    });
    expect(res.status()).toBe(401);
  });

  test('TC-061: Employee cannot register walk-ins (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP001', 'emp123');
    const res = await apiPost(request, '/walkins', token, {
      eventId: '000000000000000000000000',
      attendeeType: 'guest',
      name: 'Test',
    });
    expect(res.status()).toBe(403);
  });

  test('TC-062: Walk-in list for event (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');
    const events = await getEvents(request, token);
    const diwali = events.find(e => e.title.includes('Diwali'));
    if (diwali) {
      const res = await apiGet(request, `/walkins/event/${diwali._id}`, token);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.walkIns.length).toBeGreaterThan(0);
      expect(body.stats).toBeDefined();
    }
  });

  test('TC-063: Walk-in QR codes generation (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');
    const events = await getEvents(request, token);
    const diwali = events.find(e => e.title.includes('Diwali'));
    if (diwali) {
      const res = await apiGet(request, `/walkins/event/${diwali._id}/qrcodes`, token);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.qrCodes.length).toBe(4);
      for (const qr of body.qrCodes) {
        expect(qr.qrData).toContain('WALKIN:');
        expect(qr.qrImage).toBeTruthy();
      }
    }
  });

  test('TC-064: Walk-in tab on scanner page shows form', async ({ page }) => {
    await loginAs(page, 'volunteer');
    await page.goto('/scanner');
    await page.waitForLoadState('networkidle');
    const walkinTab = page.locator('button, [role="tab"]').filter({ hasText: /Walk-in/i }).first();
    await walkinTab.click();
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body).toMatch(/Guest|Staff|Housekeeping|Name|Phone/i);
    await page.screenshot({ path: 'e2e/reports/screenshots/TC-064-walkin-form.png', fullPage: true });
  });

  test('TC-065: Walk-in QR page accessible by admin', async ({ page }) => {
    await loginAs(page, 'admin');
    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    const eventsRes = await page.request.get('/api/events', { headers: { Authorization: `Bearer ${token}` } });
    const eventsBody = await eventsRes.json();
    const events = eventsBody.events || eventsBody;
    const diwali = events.find(e => e.title.includes('Diwali'));
    if (diwali) {
      await page.goto(`/admin/events/${diwali._id}/walkin-qr`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      expect(body).toMatch(/Guest|Staff|Housekeeping|QR/i);
      await page.screenshot({ path: 'e2e/reports/screenshots/TC-065-walkin-qr-page.png', fullPage: true });
    }
  });
});
