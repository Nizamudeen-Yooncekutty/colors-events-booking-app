/**
 * UST PassMint Load Test
 *
 * Simulates concurrent registrations and QR scans.
 * No external dependencies — uses built-in Node.js http module.
 *
 * Usage:
 *   node loadtest/load-test.js [scenario] [concurrency] [total]
 *
 * Scenarios:
 *   register  - Register employees + book events (default)
 *   scan      - Walk-in QR scans
 *   mixed     - 70% registrations, 30% scans
 *
 * Examples:
 *   node loadtest/load-test.js register 100 1000   # 100 concurrent, 1000 total registrations
 *   node loadtest/load-test.js scan 50 500          # 50 concurrent, 500 total scans
 *   node loadtest/load-test.js mixed 100 1000       # mixed workload
 */

const http = require('http');

const BASE = 'http://localhost:5000';
const SCENARIO = process.argv[2] || 'register';
const CONCURRENCY = parseInt(process.argv[3]) || 50;
const TOTAL = parseInt(process.argv[4]) || 500;

let completed = 0;
let succeeded = 0;
let failed = 0;
let totalLatency = 0;
let maxLatency = 0;
let minLatency = Infinity;
const latencies = [];
const errors = {};
let adminToken = null;
let eventId = null;
let foodPref = null;

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
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const latency = Date.now() - start;
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), latency });
        } catch {
          resolve({ status: res.statusCode, data: body, latency });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

function recordResult(res) {
  completed++;
  latencies.push(res.latency);
  totalLatency += res.latency;
  if (res.latency > maxLatency) maxLatency = res.latency;
  if (res.latency < minLatency) minLatency = res.latency;

  if (res.status >= 200 && res.status < 300) {
    succeeded++;
  } else {
    failed++;
    const key = `${res.status}: ${res.data?.message || 'Unknown'}`;
    errors[key] = (errors[key] || 0) + 1;
  }

  if (completed % 100 === 0 || completed === TOTAL) {
    const pct = Math.round((completed / TOTAL) * 100);
    const rps = Math.round(completed / ((Date.now() - globalStart) / 1000));
    process.stdout.write(`\r  ${completed}/${TOTAL} (${pct}%) | ${rps} req/s | OK: ${succeeded} | Fail: ${failed}`);
  }
}

async function registerAndBook(i) {
  const id = `LT${Date.now().toString(36)}${i}`.substring(0, 20);
  const email = `lt${Date.now()}${i}@test.com`;

  // Register
  const regRes = await request('POST', '/api/auth/register', {
    employeeId: id,
    name: `Load User ${i}`,
    email,
    password: 'Test123456',
    department: 'LoadTest',
  });

  if (regRes.status !== 201) {
    recordResult(regRes);
    return;
  }

  const token = regRes.data.token;

  // Book event
  const bookRes = await request('POST', '/api/bookings', {
    eventId,
    foodPreference: foodPref,
  }, token);

  recordResult(bookRes);
}

async function scanWalkIn() {
  const res = await request('POST', '/api/walkins/scan', {
    qrData: `WALKIN:guest:${eventId}`,
  }, adminToken);
  recordResult(res);
}

async function mixedWorkload(i) {
  if (Math.random() < 0.7) {
    await registerAndBook(i);
  } else {
    await scanWalkIn();
  }
}

async function setup() {
  console.log('Setting up...');

  // Login as admin
  const loginRes = await request('POST', '/api/auth/login', {
    employeeId: 'ADMIN001',
    password: 'admin123',
  });

  if (loginRes.status !== 200) {
    console.error('Admin login failed. Make sure ADMIN001 exists. Run: npm run seed');
    process.exit(1);
  }
  adminToken = loginRes.data.token;

  // Get first active event
  const eventsRes = await request('GET', '/api/events', null, adminToken);
  const events = eventsRes.data?.events?.filter(e => e.status === 'active') || [];
  if (events.length === 0) {
    console.error('No active events found. Run: npm run seed');
    process.exit(1);
  }
  eventId = events[0]._id;
  foodPref = events[0].foodOptions?.[0]?.name || 'Vegetarian';
  console.log(`Event: ${events[0].title} (${eventId})`);
}

async function runBatch(fn, batchStart, batchSize) {
  const promises = [];
  for (let i = batchStart; i < batchStart + batchSize && i < TOTAL; i++) {
    promises.push(fn(i).catch((err) => {
      completed++;
      failed++;
      const key = err.message || 'Network error';
      errors[key] = (errors[key] || 0) + 1;
    }));
  }
  await Promise.all(promises);
}

let globalStart;

async function run() {
  await setup();

  const fn = SCENARIO === 'scan' ? scanWalkIn
    : SCENARIO === 'mixed' ? mixedWorkload
    : registerAndBook;

  console.log(`\nLoad Test: ${SCENARIO.toUpperCase()}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Total requests: ${TOTAL}`);
  console.log(`  Target: ${BASE}\n`);

  globalStart = Date.now();

  for (let batch = 0; batch < TOTAL; batch += CONCURRENCY) {
    const size = Math.min(CONCURRENCY, TOTAL - batch);
    await runBatch(fn, batch, size);
  }

  const elapsed = (Date.now() - globalStart) / 1000;
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  console.log('\n\n━━━ Results ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Duration:     ${elapsed.toFixed(1)}s`);
  console.log(`  Total:        ${completed}`);
  console.log(`  Succeeded:    ${succeeded}`);
  console.log(`  Failed:       ${failed}`);
  console.log(`  Req/sec:      ${(completed / elapsed).toFixed(1)}`);
  console.log(`  Avg latency:  ${Math.round(totalLatency / completed)}ms`);
  console.log(`  Min latency:  ${minLatency}ms`);
  console.log(`  Max latency:  ${maxLatency}ms`);
  console.log(`  P50:          ${p50}ms`);
  console.log(`  P95:          ${p95}ms`);
  console.log(`  P99:          ${p99}ms`);

  if (Object.keys(errors).length > 0) {
    console.log('\n  Errors:');
    Object.entries(errors).sort((a, b) => b[1] - a[1]).forEach(([msg, count]) => {
      console.log(`    ${count}x ${msg}`);
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Pass/fail based on thresholds
  const rps = completed / elapsed;
  const failRate = failed / completed;

  if (failRate > 0.05) {
    console.log(`❌ FAIL: Error rate ${(failRate * 100).toFixed(1)}% exceeds 5% threshold`);
    process.exit(1);
  }
  if (p95 > 5000) {
    console.log(`❌ FAIL: P95 latency ${p95}ms exceeds 5000ms threshold`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${rps.toFixed(0)} req/s, ${(failRate * 100).toFixed(1)}% errors, P95 ${p95}ms`);
}

run().catch((err) => { console.error('Load test failed:', err); process.exit(1); });
