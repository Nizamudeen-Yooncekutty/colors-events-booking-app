/**
 * UST PassMint Stress Test — Find the Breaking Point
 *
 * Escalates concurrency in steps until the system degrades.
 * All requests come from ONE IP (worst case: corporate NAT).
 *
 * Usage: node loadtest/stress-test.js [scenario]
 *   scenario: register | scan | read
 */

const http = require('http');

const BASE = 'http://localhost:5000';
const SCENARIO = process.argv[2] || 'scan';

let adminToken = null;
let eventId = null;
let foodPref = null;
let userTokens = [];

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(data && { 'Content-Length': Buffer.byteLength(data) }),
      },
    };

    const start = Date.now();
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const latency = Date.now() - start;
        try { resolve({ status: res.statusCode, data: JSON.parse(body), latency }); }
        catch { resolve({ status: res.statusCode, data: body, latency }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, data: e.message, latency: Date.now() - start }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ status: 0, data: 'Timeout', latency: 30000 }); });
    if (data) req.write(data);
    req.end();
  });
}

async function setup() {
  console.log('Setting up...');
  const loginRes = await request('POST', '/api/auth/login', { employeeId: 'ADMIN001', password: 'admin123' });
  if (loginRes.status !== 200) { console.error('Admin login failed. Run: npm run seed'); process.exit(1); }
  adminToken = loginRes.data.token;

  const eventsRes = await request('GET', '/api/events', null, adminToken);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const events = (eventsRes.data?.events || []).filter(e => {
    if (e.status !== 'active') return false;
    const s = new Date(e.registrationStart), en = new Date(e.registrationEnd);
    return today >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) &&
           today <= new Date(en.getFullYear(), en.getMonth(), en.getDate());
  });
  if (events.length === 0) { console.error('No events with open registration.'); process.exit(1); }
  eventId = events[0]._id;
  foodPref = events[0].foodOptions?.[0]?.name || 'Vegetarian';
  console.log(`Event: ${events[0].title}\n`);

  // Pre-create some users for read tests
  if (SCENARIO === 'read') {
    for (let i = 0; i < 5; i++) {
      const r = Math.random().toString(36).substring(2, 8).toUpperCase();
      const res = await request('POST', '/api/auth/register', {
        employeeId: `ST${r}`, name: 'Stress User', email: `st${r}@test.com`, password: 'Test123456',
      });
      if (res.data?.token) userTokens.push(res.data.token);
    }
  }
}

async function runBatch(fn, count) {
  const promises = [];
  for (let i = 0; i < count; i++) promises.push(fn(i));
  return Promise.all(promises);
}

async function stressStep(fn, concurrency, requestsPerStep) {
  const results = [];
  const start = Date.now();

  for (let batch = 0; batch < requestsPerStep; batch += concurrency) {
    const size = Math.min(concurrency, requestsPerStep - batch);
    const batchResults = await runBatch(fn, size);
    results.push(...batchResults);
  }

  const elapsed = (Date.now() - start) / 1000;
  const latencies = results.map(r => r.latency).sort((a, b) => a - b);
  const ok = results.filter(r => r.status >= 200 && r.status < 300).length;
  const rateLimited = results.filter(r => r.status === 429).length;
  const serverErrors = results.filter(r => r.status >= 500).length;
  const timeouts = results.filter(r => r.status === 0).length;
  const errors = results.length - ok;

  return {
    concurrency,
    total: results.length,
    ok,
    errors,
    rateLimited,
    serverErrors,
    timeouts,
    rps: (results.length / elapsed).toFixed(1),
    avgMs: Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length),
    p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
    p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
    p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
    maxMs: latencies[latencies.length - 1] || 0,
    errorRate: ((errors / results.length) * 100).toFixed(1),
  };
}

async function run() {
  await setup();

  const steps = [1, 5, 10, 25, 50, 100, 200, 500];
  const requestsPerStep = 200;

  const names = ['Arun','Priya','Vikram','Sneha','Rohit','Meera','Arjun','Pooja','Sanjay','Nisha'];
  const surnames = ['Kumar','Nair','Joshi','Reddy','Verma','Krishnan','Nambiar','Gupta','Patel','Thomas'];
  let counter = 0;

  const scenarios = {
    register: (i) => {
      const r = Math.random().toString(36).substring(2, 8).toUpperCase();
      const c = counter++;
      return request('POST', '/api/auth/register', {
        employeeId: `ST${r}${c}`.substring(0, 20),
        name: `${names[c % 10]} ${surnames[c % 10]}`,
        email: `st${r}${c}@test.com`,
        password: 'Test123456', department: 'Stress',
      });
    },
    scan: () => request('POST', '/api/walkins/scan', { qrData: `WALKIN:guest:${eventId}` }, adminToken),
    read: () => request('GET', '/api/events', null, userTokens[Math.floor(Math.random() * userTokens.length)] || adminToken),
  };

  const fn = scenarios[SCENARIO];
  if (!fn) { console.error(`Unknown scenario: ${SCENARIO}. Use: register, scan, read`); process.exit(1); }

  console.log(`Stress Test: ${SCENARIO.toUpperCase()} (all from single IP)`);
  console.log(`Steps: ${steps.join(', ')} concurrent`);
  console.log(`${requestsPerStep} requests per step\n`);

  console.log('Concurrency │ Total │   OK │ Errors │  429s │  5xx │ Timeout │  Req/s │ Avg ms │ P50 ms │ P95 ms │ P99 ms │ Max ms │ Err %');
  console.log('────────────┼───────┼──────┼────────┼───────┼──────┼─────────┼────────┼────────┼────────┼────────┼────────┼────────┼──────');

  let brokeAt = null;

  for (const concurrency of steps) {
    const r = await stressStep(fn, concurrency, requestsPerStep);
    const row = [
      String(r.concurrency).padStart(11),
      String(r.total).padStart(5),
      String(r.ok).padStart(4),
      String(r.errors).padStart(6),
      String(r.rateLimited).padStart(5),
      String(r.serverErrors).padStart(4),
      String(r.timeouts).padStart(7),
      String(r.rps).padStart(6),
      String(r.avgMs).padStart(6),
      String(r.p50).padStart(6),
      String(r.p95).padStart(6),
      String(r.p99).padStart(6),
      String(r.maxMs).padStart(6),
      `${r.errorRate}%`.padStart(5),
    ].join(' │ ');
    console.log(row);

    if (!brokeAt && (parseFloat(r.errorRate) > 5 || r.p95 > 10000)) {
      brokeAt = concurrency;
    }

    // Stop if system is totally broken
    if (r.timeouts > requestsPerStep * 0.5) {
      console.log('\n⛔ Halted: >50% timeouts. System is overwhelmed.');
      break;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (brokeAt) {
    console.log(`⚠️  System degrades at ${brokeAt} concurrent requests (single IP)`);
    console.log(`   Safe production limit per IP: ${Math.floor(brokeAt * 0.7)}/min recommended`);
  } else {
    console.log(`✅ System handled all steps up to ${steps[steps.length - 1]} concurrent without degradation`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

run().catch(e => { console.error('Stress test failed:', e); process.exit(1); });
