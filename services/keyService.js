const crypto = require('crypto');
const { pool } = require('../config/db');

/**
 * Hash raw API key using SHA-256
 * @param {string} rawKey 
 * @returns {string} 64-character hex hash
 */
function hashKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return '';
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

/**
 * Generate cryptographically secure API key
 * Format: uap_<role>_<32-byte-hex>
 * @param {string} role 'admin' | 'teacher' | 'student'
 * @returns {string}
 */
function generateRawKey(role = 'live') {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `uap_${role}_${randomBytes}`;
}

/**
 * Extract safe display prefix (e.g., uap_student_a1b2...c3d4)
 * @param {string} rawKey 
 * @returns {string}
 */
function extractPrefix(rawKey) {
  if (!rawKey || rawKey.length < 16) return 'uap_key_***';
  return `${rawKey.slice(0, 14)}...${rawKey.slice(-4)}`;
}

/**
 * Generate and store a new API Key in database
 * @param {Object} param0 
 * @returns {Promise<{ rawKey: string, keyRecord: Object }>}
 */
async function createApiKey({ ownerType, ownerId, keyName, requestLimit = 100 }) {
  if (!['student', 'teacher', 'admin'].includes(ownerType)) {
    throw new Error('Invalid owner_type. Must be student, teacher, or admin.');
  }

  const rawKey = generateRawKey(ownerType);
  const keyHash = hashKey(rawKey);
  const prefix = extractPrefix(rawKey);

  const [result] = await pool.execute(
    `INSERT INTO api_keys 
      (key_prefix, key_hash, owner_type, owner_id, key_name, request_limit, request_count, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'active', NOW())`,
    [prefix, keyHash, ownerType, ownerId || null, keyName || `${ownerType.toUpperCase()} Access Key`, requestLimit]
  );

  const [rows] = await pool.execute(
    `SELECT id, key_prefix, owner_type, owner_id, key_name, request_limit, request_count, status, created_at 
     FROM api_keys WHERE id = ?`,
    [result.insertId]
  );

  return {
    rawKey,
    keyRecord: rows[0]
  };
}

/**
 * Validate raw key and retrieve details including owner data
 * @param {string} rawKey 
 * @returns {Promise<Object|null>}
 */
async function getKeyDetailsByRawKey(rawKey) {
  if (!rawKey) return null;
  const keyHash = hashKey(rawKey);

  const [keys] = await pool.execute(
    `SELECT id, key_prefix, key_hash, owner_type, owner_id, key_name, request_limit, request_count, status, created_at, last_used_at, revoked_at
     FROM api_keys 
     WHERE key_hash = ?`,
    [keyHash]
  );

  if (keys.length === 0) return null;
  const key = keys[0];

  let ownerInfo = null;
  if (key.owner_type === 'student' && key.owner_id) {
    const [students] = await pool.execute(
      `SELECT id, student_number, full_name, email, department, semester, created_at 
       FROM students WHERE id = ?`,
      [key.owner_id]
    );
    if (students.length > 0) ownerInfo = students[0];
  } else if (key.owner_type === 'teacher' && key.owner_id) {
    const [teachers] = await pool.execute(
      `SELECT id, teacher_number, full_name, email, department, created_at 
       FROM teachers WHERE id = ?`,
      [key.owner_id]
    );
    if (teachers.length > 0) ownerInfo = teachers[0];
  } else if (key.owner_type === 'admin') {
    ownerInfo = {
      id: 0,
      full_name: 'System Administrator',
      role: 'admin',
      email: 'admin@university.edu'
    };
  }

  return {
    ...key,
    owner: ownerInfo
  };
}

/**
 * Revoke an API Key
 * @param {number} keyId 
 * @returns {Promise<boolean>}
 */
async function revokeKey(keyId) {
  const [result] = await pool.execute(
    `UPDATE api_keys 
     SET status = 'revoked', revoked_at = NOW() 
     WHERE id = ?`,
    [keyId]
  );
  return result.affectedRows > 0;
}

/**
 * Update request limit for an API Key
 * @param {number} keyId 
 * @param {number} newLimit 
 * @returns {Promise<boolean>}
 */
async function updateLimit(keyId, newLimit) {
  const [result] = await pool.execute(
    `UPDATE api_keys 
     SET request_limit = ? 
     WHERE id = ?`,
    [newLimit, keyId]
  );
  return result.affectedRows > 0;
}

/**
 * Ensure Predefined Admin Key exists in database
 * @param {string} rawAdminKey 
 */
async function ensureAdminKey(rawAdminKey) {
  if (!rawAdminKey) return null;
  const keyHash = hashKey(rawAdminKey);
  const prefix = extractPrefix(rawAdminKey);

  const [existing] = await pool.execute(
    `SELECT id FROM api_keys WHERE key_hash = ?`,
    [keyHash]
  );

  if (existing.length === 0) {
    const [result] = await pool.execute(
      `INSERT INTO api_keys 
        (key_prefix, key_hash, owner_type, owner_id, key_name, request_limit, request_count, status, created_at)
       VALUES (?, ?, 'admin', NULL, 'Predefined Master Admin Key', 1000000, 0, 'active', NOW())`,
      [prefix, keyHash]
    );
    console.log(`✅ Predefined Admin Key registered with ID #${result.insertId}`);
    return result.insertId;
  }
  return existing[0].id;
}

module.exports = {
  hashKey,
  generateRawKey,
  extractPrefix,
  createApiKey,
  getKeyDetailsByRawKey,
  revokeKey,
  updateLimit,
  ensureAdminKey
};
