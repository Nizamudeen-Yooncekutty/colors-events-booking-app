const { expect } = require('@playwright/test');

const USERS = {
  admin: { employeeId: 'ADMIN001', password: 'admin123', role: 'admin' },
  admin2: { employeeId: 'ADMIN002', password: 'admin123', role: 'admin' },
  volunteer: { employeeId: 'VOL001', password: 'vol123', role: 'volunteer' },
  volunteer2: { employeeId: 'VOL002', password: 'vol123', role: 'volunteer' },
  employee: { employeeId: 'EMP001', password: 'emp123', role: 'employee' },
  employee2: { employeeId: 'EMP002', password: 'emp123', role: 'employee' },
  employee3: { employeeId: 'EMP003', password: 'emp123', role: 'employee' },
  employeeNoBkng: { employeeId: 'EMP020', password: 'emp123', role: 'employee' },
};

async function loginAs(page, userKey) {
  const user = USERS[userKey];
  if (!user) throw new Error(`Unknown user key: ${userKey}`);

  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="text"], input[placeholder*="Employee" i], input[name="employeeId"]', user.employeeId, { timeout: 5000 }).catch(async () => {
    const inputs = page.locator('input');
    await inputs.first().fill(user.employeeId);
  });
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(events|admin|scanner)/, { timeout: 15000 });
  return user;
}

async function loginViaAPI(page, userKey) {
  const user = USERS[userKey];
  const response = await page.request.post('/api/auth/login', {
    data: { employeeId: user.employeeId, password: user.password },
  });
  const body = await response.json();
  await page.evaluate((token) => {
    sessionStorage.setItem('token', token.token);
    sessionStorage.setItem('employee', JSON.stringify(token.employee));
  }, body);
  return { ...user, token: body.token, employee: body.employee };
}

module.exports = { USERS, loginAs, loginViaAPI };
