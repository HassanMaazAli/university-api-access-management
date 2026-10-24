/**
 * Comprehensive Automated API & Security Test Suite
 * Validates all assignment requirements:
 * 1. Missing / invalid / query-string keys (400 / 401)
 * 2. Role-based restrictions: Student -> Teacher (403), Teacher -> Admin (403)
 * 3. Student data isolation: Student gets only their own records, derived strictly from key
 * 4. Quota enforcement: 429 when quota is reached
 * 5. Revocation enforcement: 403 when revoked
 * 6. Admin management: stats, generation, limit updates, revocation, and audit logs
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const ADMIN_KEY = 'uap_admin_secret_99887766554433221100aabbcc';
const TEACHER_KEY = 'uap_teacher_alan_turing_sec_2026_demo_key';
const STUDENT_1_KEY = 'uap_student_zainab_ahmed_2026_demo_key';
const STUDENT_2_KEY = 'uap_student_bilal_hassan_2026_demo_key';
const REVOKED_KEY = 'uap_student_revoked_test_key_sample_403';
const RATE_LIMITED_KEY = 'uap_student_rate_limited_sample_429';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function makeRequest({ path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };

    let payload = null;
    if (body) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    failedTests++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('🧪 Starting University API Automated Verification Suite');
  console.log(`🎯 Target Server: ${BASE_URL}`);
  console.log('=============================================================\n');

  // Group 0: Static Page Navigation Routes
  console.log('--- 0. WEB PAGE ROUTES TESTS ---');

  for (const page of ['/', '/admin', '/student/dashboard', '/teacher/dashboard', '/settings']) {
    await test(`Serve static page: ${page} (HTTP 200)`, async () => {
      const res = await makeRequest({ path: page });
      assert(res.statusCode === 200, `Expected 200 for ${page}, got ${res.statusCode}`);
    });
  }

  // Group 1: General Authentication & Protocol Security
  console.log('\n--- 1. PROTOCOL & AUTHENTICATION TESTS ---');

  await test('Reject requests without x-api-key header (HTTP 401)', async () => {
    const res = await makeRequest({ path: '/api/admin/stats' });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    assert(res.data.error === 'Unauthorized', 'Expected Unauthorized error');
  });

  await test('Reject API key passed in query parameter (HTTP 400)', async () => {
    const res = await makeRequest({ path: `/api/admin/stats?api_key=${ADMIN_KEY}` });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.data.message.includes('query parameters'), 'Should mention query parameter prohibition');
  });

  await test('Reject invalid/fake API key (HTTP 401)', async () => {
    const res = await makeRequest({
      path: '/api/admin/stats',
      headers: { 'x-api-key': 'uap_fake_invalid_key_123456789' }
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  await test('Reject revoked API key (HTTP 403 Forbidden)', async () => {
    const res = await makeRequest({
      path: '/api/student/profile',
      headers: { 'x-api-key': REVOKED_KEY }
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    assert(res.data.message.includes('revoked'), 'Should state key has been revoked');
  });

  await test('Reject rate-limited API key when quota exceeded (HTTP 429)', async () => {
    const res = await makeRequest({
      path: '/api/student/profile',
      headers: { 'x-api-key': RATE_LIMITED_KEY }
    });
    assert(res.statusCode === 429, `Expected 429, got ${res.statusCode}`);
    assert(res.data.message.includes('quota exceeded'), 'Should state quota exceeded');
  });

  // Group 2: Key Validation Endpoint
  console.log('\n--- 2. KEY VALIDATION & SETTINGS ENDPOINT ---');

  await test('Validate key endpoint returns safe account info', async () => {
    const res = await makeRequest({
      path: '/api/auth/validate',
      method: 'POST',
      body: { apiKey: STUDENT_1_KEY }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.valid === true, 'Expected valid: true');
    assert(res.data.ownerType === 'student', 'Expected ownerType: student');
    assert(res.data.owner.full_name === 'Zainab Ahmed', 'Expected owner name Zainab Ahmed');
    assert(!res.data.key_hash, 'Key hash must never be returned');
  });

  // Group 3: Student Identity Isolation & RBAC
  console.log('\n--- 3. STUDENT DATA ISOLATION & PERMISSIONS ---');

  await test('Student 1 receives only their own profile derived strictly from key', async () => {
    const res = await makeRequest({
      path: '/api/student/profile',
      headers: { 'x-api-key': STUDENT_1_KEY }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.student.student_number === 'STD-2023-1001', 'Should be Zainab Ahmed');
    assert(res.data.student.id === 1, 'Should match student id 1');
  });

  await test('Student 2 receives only their own profile derived strictly from key', async () => {
    const res = await makeRequest({
      path: '/api/student/profile',
      headers: { 'x-api-key': STUDENT_2_KEY }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.student.student_number === 'STD-2023-1002', 'Should be Bilal Hassan');
    assert(res.data.student.id === 2, 'Should match student id 2');
  });

  await test('Student receives their own marks with calculated percentages', async () => {
    const res = await makeRequest({
      path: '/api/student/marks',
      headers: { 'x-api-key': STUDENT_1_KEY }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(Array.isArray(res.data.marks), 'Marks must be an array');
    assert(res.data.marks.length === 3, `Expected 3 subjects, got ${res.data.marks.length}`);
    assert(res.data.summary.percentage > 80, 'Percentage calculation verified');
  });

  await test('Student blocked from Teacher endpoint (HTTP 403)', async () => {
    const res = await makeRequest({
      path: '/api/teacher/students',
      headers: { 'x-api-key': STUDENT_1_KEY }
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
  });

  await test('Student blocked from Admin endpoint (HTTP 403)', async () => {
    const res = await makeRequest({
      path: '/api/admin/stats',
      headers: { 'x-api-key': STUDENT_1_KEY }
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
  });

  // Group 4: Teacher Access & RBAC
  console.log('\n--- 4. TEACHER ACCESS & DIRECTORY ---');

  await test('Teacher can view teacher profile', async () => {
    const res = await makeRequest({
      path: '/api/teacher/profile',
      headers: { 'x-api-key': TEACHER_KEY }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.teacher.full_name === 'Dr. Alan Turing', 'Expected Alan Turing');
  });

  await test('Teacher can view student directory', async () => {
    const res = await makeRequest({
      path: '/api/teacher/students',
      headers: { 'x-api-key': TEACHER_KEY }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.students.length >= 10, 'Expected at least 10 students');
  });

  await test('Teacher can view all academic marks with stats', async () => {
    const res = await makeRequest({
      path: '/api/teacher/marks',
      headers: { 'x-api-key': TEACHER_KEY }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.marks.length >= 30, 'Expected at least 30 mark records');
    assert(res.data.stats.totalStudents >= 10, 'Stats verify student count');
  });

  await test('Teacher blocked from Admin endpoint (HTTP 403)', async () => {
    const res = await makeRequest({
      path: '/api/admin/stats',
      headers: { 'x-api-key': TEACHER_KEY }
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
  });

  // Group 5: Admin Management & Key Lifecycle
  console.log('\n--- 5. ADMIN CAPABILITIES & LIFECYCLE ---');

  await test('Admin accesses stats overview', async () => {
    const res = await makeRequest({
      path: '/api/admin/stats',
      headers: { 'x-api-key': ADMIN_KEY }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.stats.totalStudents >= 10, 'Stats totalStudents correct');
    assert(res.data.stats.totalTeachers >= 3, 'Stats totalTeachers correct');
  });

  let newlyCreatedKey = null;
  let newlyCreatedKeyId = null;

  await test('Admin generates a new API key for student (HTTP 201)', async () => {
    const res = await makeRequest({
      path: '/api/admin/api-keys',
      method: 'POST',
      headers: { 'x-api-key': ADMIN_KEY },
      body: {
        ownerType: 'student',
        ownerId: 5,
        keyName: 'Ayesha Khan Lab Key',
        requestLimit: 250
      }
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.data.rawKey.startsWith('uap_student_'), 'Key format should match uap_student_...');
    newlyCreatedKey = res.data.rawKey;
    newlyCreatedKeyId = res.data.keyRecord.id;
  });

  await test('Newly generated API key works immediately', async () => {
    const res = await makeRequest({
      path: '/api/student/profile',
      headers: { 'x-api-key': newlyCreatedKey }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.student.student_number === 'STD-2022-1005', 'Student should be Ayesha Khan');
  });

  await test('Admin updates request limit on newly created key', async () => {
    const res = await makeRequest({
      path: `/api/admin/api-keys/${newlyCreatedKeyId}/limit`,
      method: 'PATCH',
      headers: { 'x-api-key': ADMIN_KEY },
      body: { requestLimit: 500 }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.newLimit === 500, 'Limit should be 500');
  });

  await test('Admin revokes the newly created key', async () => {
    const res = await makeRequest({
      path: `/api/admin/api-keys/${newlyCreatedKeyId}/revoke`,
      method: 'PATCH',
      headers: { 'x-api-key': ADMIN_KEY }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.status === 'revoked', 'Status should be revoked');
  });

  await test('Revoked key is immediately rejected on subsequent requests (HTTP 403)', async () => {
    const res = await makeRequest({
      path: '/api/student/profile',
      headers: { 'x-api-key': newlyCreatedKey }
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
  });

  await test('Admin views audit request logs', async () => {
    const res = await makeRequest({
      path: '/api/admin/logs?limit=10',
      headers: { 'x-api-key': ADMIN_KEY }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(Array.isArray(res.data.logs), 'Logs must be an array');
    assert(res.data.logs.length > 0, 'Audit logs have recorded requests');
  });

  console.log('\n=============================================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Start server locally if not running, then execute
const app = require('../server');
// Give server 500ms to listen
setTimeout(() => {
  runTestSuite().catch(err => {
    console.error('Test Suite Error:', err);
    process.exit(1);
  });
}, 800);
