const { test, expect } = require('@playwright/test');
const { apiGetToken, apiGet, apiPost, apiDelete, apiPatch } = require('../helpers/api');

test.describe('TS-007: Admin Role Management', () => {

  test('TC-082: List role users (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiGet(request, '/admin/role-users', token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.roleUsers).toBeDefined();
  });

  test('TC-083: Add role user as admin (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiPost(request, '/admin/role-users', token, {
      email: 'e2e-test-admin@ust.com',
      role: 'admin',
      name: 'E2E Test Admin',
    });
    expect([200, 201]).toContain(res.status());
  });

  test('TC-084: Add role user as volunteer (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiPost(request, '/admin/role-users', token, {
      email: 'e2e-test-vol@ust.com',
      role: 'volunteer',
      name: 'E2E Test Vol',
    });
    expect([200, 201]).toContain(res.status());
  });

  test('TC-085: Update existing role user (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiPost(request, '/admin/role-users', token, {
      email: 'e2e-test-vol@ust.com',
      role: 'admin',
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.message.toLowerCase()).toContain('updated');
  });

  test('TC-086: Add role user with invalid email rejected (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiPost(request, '/admin/role-users', token, {
      email: 'not-an-email',
      role: 'admin',
    });
    expect(res.status()).toBe(400);
  });

  test('TC-087: Add role user with invalid role rejected (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiPost(request, '/admin/role-users', token, {
      email: 'test@ust.com',
      role: 'superadmin',
    });
    expect(res.status()).toBe(400);
  });

  test('TC-088: Delete role user (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const listRes = await apiGet(request, '/admin/role-users', token);
    const { roleUsers } = await listRes.json();
    const testUser = roleUsers.find(r => r.email.includes('e2e-test'));
    if (testUser) {
      const res = await apiDelete(request, `/admin/role-users/${testUser._id}`, token);
      expect(res.status()).toBe(200);
    }
  });

  test('TC-089: Change employee role directly (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const empRes = await apiGet(request, '/admin/employees', token);
    const { employees } = await empRes.json();
    const emp = employees.find(e => e.employeeId === 'EMP020');
    if (emp) {
      const res = await apiPatch(request, `/admin/employees/${emp._id}/role`, token, {
        role: 'volunteer',
      });
      expect(res.status()).toBe(200);
      // Revert
      await apiPatch(request, `/admin/employees/${emp._id}/role`, token, {
        role: 'employee',
      });
    }
  });

  test('TC-090: Change role with invalid role rejected (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const empRes = await apiGet(request, '/admin/employees', token);
    const { employees } = await empRes.json();
    const emp = employees[0];
    const res = await apiPatch(request, `/admin/employees/${emp._id}/role`, token, {
      role: 'superadmin',
    });
    expect(res.status()).toBe(400);
  });

  test('TC-091: Employee cannot manage roles (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'EMP001', 'emp123');
    const res = await apiGet(request, '/admin/role-users', token);
    expect(res.status()).toBe(403);
  });

  test('TC-092: Volunteer cannot manage roles (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'VOL001', 'vol123');
    const res = await apiGet(request, '/admin/role-users', token);
    expect(res.status()).toBe(403);
  });

  test('TC-093: List employees with search (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiGet(request, '/admin/employees?search=Rajesh', token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.employees.length).toBeGreaterThan(0);
    expect(body.employees[0].name).toContain('Rajesh');
  });

  test('TC-094: List employees filtered by role (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const res = await apiGet(request, '/admin/employees?role=admin', token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const emp of body.employees) {
      expect(emp.role).toBe('admin');
    }
  });

  // Cleanup remaining test role users
  test('TC-095: Cleanup test role users (API)', async ({ request }) => {
    const token = await apiGetToken(request, 'ADMIN001', 'admin123');
    const listRes = await apiGet(request, '/admin/role-users', token);
    const { roleUsers } = await listRes.json();
    for (const ru of roleUsers.filter(r => r.email.includes('e2e-test'))) {
      await apiDelete(request, `/admin/role-users/${ru._id}`, token);
    }
  });
});
