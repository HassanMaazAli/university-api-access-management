const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { createApiKey, hashKey, extractPrefix } = require('../services/keyService');

async function initDatabase() {
  console.log('🔄 Initializing University API Database & Seeding Records...');

  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('🔌 Connected to MySQL server.');

    // Read database.sql
    const sqlPath = path.join(__dirname, '..', 'database.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    console.log('📜 Executing database.sql schema & seed script...');
    await connection.query(sqlScript);
    console.log('✅ Database `university_api_system` created and populated successfully.');
    await connection.end();

    // Now connect to the university_api_system database to seed demo API keys
    const appDb = await mysql.createConnection({
      ...dbConfig,
      database: process.env.DB_NAME || 'university_api_system'
    });

    console.log('🔑 Setting up initial Demo API Keys...');

    // 1. Admin Master Key
    const rawAdminKey = process.env.ADMIN_API_KEY || 'uap_admin_secret_99887766554433221100aabbcc';
    const adminHash = hashKey(rawAdminKey);
    const adminPrefix = extractPrefix(rawAdminKey);

    await appDb.execute(
      `INSERT INTO api_keys (key_prefix, key_hash, owner_type, owner_id, key_name, request_limit, request_count, status, created_at)
       VALUES (?, ?, 'admin', NULL, 'Master Admin API Key', 1000000, 0, 'active', NOW())
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [adminPrefix, adminHash]
    );

    // 2. Demo Teacher Key: Dr. Alan Turing (Teacher ID 1)
    const teacherRawKey = 'uap_teacher_alan_turing_sec_2026_demo_key';
    const teacherHash = hashKey(teacherRawKey);
    const teacherPrefix = extractPrefix(teacherRawKey);
    await appDb.execute(
      `INSERT INTO api_keys (key_prefix, key_hash, owner_type, owner_id, key_name, request_limit, request_count, status, created_at)
       VALUES (?, ?, 'teacher', 1, 'Dr. Alan Turing Faculty Key', 500, 0, 'active', NOW())
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [teacherPrefix, teacherHash]
    );

    // 3. Demo Student Key: Zainab Ahmed (Student ID 1)
    const student1RawKey = 'uap_student_zainab_ahmed_2026_demo_key';
    const student1Hash = hashKey(student1RawKey);
    const student1Prefix = extractPrefix(student1RawKey);
    await appDb.execute(
      `INSERT INTO api_keys (key_prefix, key_hash, owner_type, owner_id, key_name, request_limit, request_count, status, created_at)
       VALUES (?, ?, 'student', 1, 'Zainab Ahmed Academic Key', 100, 0, 'active', NOW())
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [student1Prefix, student1Hash]
    );

    // 4. Demo Student Key: Bilal Hassan (Student ID 2)
    const student2RawKey = 'uap_student_bilal_hassan_2026_demo_key';
    const student2Hash = hashKey(student2RawKey);
    const student2Prefix = extractPrefix(student2RawKey);
    await appDb.execute(
      `INSERT INTO api_keys (key_prefix, key_hash, owner_type, owner_id, key_name, request_limit, request_count, status, created_at)
       VALUES (?, ?, 'student', 2, 'Bilal Hassan Academic Key', 100, 0, 'active', NOW())
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [student2Prefix, student2Hash]
    );

    // 5. Revoked Key for testing 403
    const revokedRawKey = 'uap_student_revoked_test_key_sample_403';
    const revokedHash = hashKey(revokedRawKey);
    const revokedPrefix = extractPrefix(revokedRawKey);
    await appDb.execute(
      `INSERT INTO api_keys (key_prefix, key_hash, owner_type, owner_id, key_name, request_limit, request_count, status, created_at, revoked_at)
       VALUES (?, ?, 'student', 3, 'Fatima Noor Revoked Test Key', 100, 5, 'revoked', NOW(), NOW())
       ON DUPLICATE KEY UPDATE status = 'revoked'`,
      [revokedPrefix, revokedHash]
    );

    // 6. Rate-limited key for testing 429
    const rateLimitedRawKey = 'uap_student_rate_limited_sample_429';
    const rateLimitedHash = hashKey(rateLimitedRawKey);
    const rateLimitedPrefix = extractPrefix(rateLimitedRawKey);
    await appDb.execute(
      `INSERT INTO api_keys (key_prefix, key_hash, owner_type, owner_id, key_name, request_limit, request_count, status, created_at)
       VALUES (?, ?, 'student', 4, 'Hamza Tariq Quota Exceeded Key', 50, 50, 'active', NOW())
       ON DUPLICATE KEY UPDATE request_count = 50`,
      [rateLimitedPrefix, rateLimitedHash]
    );

    await appDb.end();

    console.log('\n=============================================================');
    console.log('🎉 Database Initialization & Demo Seeding Complete!');
    console.log('=============================================================');
    console.log('🛡️  ADMIN MASTER KEY:');
    console.log(`   ${rawAdminKey}\n`);
    console.log('👨‍🏫 TEACHER KEY (Dr. Alan Turing - CS):');
    console.log(`   ${teacherRawKey}\n`);
    console.log('👨‍🎓 STUDENT KEY (Zainab Ahmed - STD-2023-1001):');
    console.log(`   ${student1RawKey}\n`);
    console.log('👨‍🎓 STUDENT KEY (Bilal Hassan - STD-2023-1002):');
    console.log(`   ${student2RawKey}\n`);
    console.log('🚫 REVOKED KEY (For testing 403 Forbidden):');
    console.log(`   ${revokedRawKey}\n`);
    console.log('⚠️  QUOTA-EXCEEDED KEY (For testing 429 Rate Limit):');
    console.log(`   ${rateLimitedRawKey}\n`);
    console.log('=============================================================');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Failed:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

initDatabase();
