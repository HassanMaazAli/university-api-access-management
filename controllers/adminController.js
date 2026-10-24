const { pool } = require('../config/db');
const keyService = require('../services/keyService');

/**
 * GET /api/admin/stats
 * Dashboard overview statistics
 */
async function getStats(req, res) {
  try {
    const [[studentsCount]] = await pool.execute('SELECT COUNT(*) AS total FROM students');
    const [[teachersCount]] = await pool.execute('SELECT COUNT(*) AS total FROM teachers');
    const [[activeKeysCount]] = await pool.execute("SELECT COUNT(*) AS total FROM api_keys WHERE status = 'active'");
    const [[revokedKeysCount]] = await pool.execute("SELECT COUNT(*) AS total FROM api_keys WHERE status = 'revoked'");
    const [[usageStats]] = await pool.execute('SELECT COALESCE(SUM(request_count), 0) AS total_requests FROM api_keys');
    const [[logsCount]] = await pool.execute('SELECT COUNT(*) AS total FROM api_request_logs');

    // Recent 5 activity logs
    const [recentLogs] = await pool.execute(
      `SELECT l.id, l.api_key_id, l.endpoint, l.http_method, l.response_status, l.requested_at,
              k.key_prefix, k.owner_type
       FROM api_request_logs l
       LEFT JOIN api_keys k ON l.api_key_id = k.id
       ORDER BY l.requested_at DESC
       LIMIT 5`
    );

    return res.json({
      success: true,
      stats: {
        totalStudents: studentsCount.total,
        totalTeachers: teachersCount.total,
        activeKeys: activeKeysCount.total,
        revokedKeys: revokedKeysCount.total,
        totalRequests: Number(usageStats.total_requests),
        totalLogs: logsCount.total
      },
      recentLogs
    });
  } catch (error) {
    console.error('Admin Stats Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve stats.' });
  }
}

/**
 * GET /api/admin/students
 * List, filter and search students
 */
async function getStudents(req, res) {
  try {
    const { search = '', department = '', semester = '' } = req.query;
    let query = 'SELECT id, student_number, full_name, email, department, semester, created_at FROM students WHERE 1=1';
    const params = [];

    if (search.trim()) {
      query += ' AND (full_name LIKE ? OR student_number LIKE ? OR email LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (department.trim()) {
      query += ' AND department = ?';
      params.push(department.trim());
    }

    if (semester && !isNaN(parseInt(semester, 10))) {
      query += ' AND semester = ?';
      params.push(parseInt(semester, 10));
    }

    query += ' ORDER BY student_number ASC';

    const [students] = await pool.execute(query, params);
    return res.json({ success: true, count: students.length, students });
  } catch (error) {
    console.error('Admin Students Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve students.' });
  }
}

/**
 * GET /api/admin/teachers
 * List and search teachers
 */
async function getTeachers(req, res) {
  try {
    const { search = '', department = '' } = req.query;
    let query = 'SELECT id, teacher_number, full_name, email, department, created_at FROM teachers WHERE 1=1';
    const params = [];

    if (search.trim()) {
      query += ' AND (full_name LIKE ? OR teacher_number LIKE ? OR email LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (department.trim()) {
      query += ' AND department = ?';
      params.push(department.trim());
    }

    query += ' ORDER BY teacher_number ASC';

    const [teachers] = await pool.execute(query, params);
    return res.json({ success: true, count: teachers.length, teachers });
  } catch (error) {
    console.error('Admin Teachers Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve teachers.' });
  }
}

/**
 * GET /api/admin/api-keys
 * List managed API keys (Never expose key_hash or raw keys)
 */
async function getApiKeys(req, res) {
  try {
    const { owner_type = '', status = '', search = '' } = req.query;
    let query = `
      SELECT 
        k.id, 
        k.key_prefix, 
        k.owner_type, 
        k.owner_id, 
        k.key_name, 
        k.request_limit, 
        k.request_count, 
        k.status, 
        k.created_at, 
        k.last_used_at, 
        k.revoked_at,
        CASE 
          WHEN k.owner_type = 'student' THEN s.full_name
          WHEN k.owner_type = 'teacher' THEN t.full_name
          ELSE 'System Administrator'
        END AS owner_name,
        CASE 
          WHEN k.owner_type = 'student' THEN s.email
          WHEN k.owner_type = 'teacher' THEN t.email
          ELSE 'admin@university.edu'
        END AS owner_email,
        CASE 
          WHEN k.owner_type = 'student' THEN s.student_number
          WHEN k.owner_type = 'teacher' THEN t.teacher_number
          ELSE 'ADMIN-MASTER'
        END AS owner_number
      FROM api_keys k
      LEFT JOIN students s ON k.owner_type = 'student' AND k.owner_id = s.id
      LEFT JOIN teachers t ON k.owner_type = 'teacher' AND k.owner_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (owner_type.trim()) {
      query += ' AND k.owner_type = ?';
      params.push(owner_type.trim());
    }

    if (status.trim()) {
      query += ' AND k.status = ?';
      params.push(status.trim());
    }

    if (search.trim()) {
      query += ' AND (k.key_name LIKE ? OR k.key_prefix LIKE ? OR s.full_name LIKE ? OR t.full_name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY k.created_at DESC';

    const [keys] = await pool.execute(query, params);
    return res.json({ success: true, count: keys.length, keys });
  } catch (error) {
    console.error('Admin API Keys Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve API keys.' });
  }
}

/**
 * POST /api/admin/api-keys
 * Generate new API key
 */
async function generateApiKey(req, res) {
  try {
    const { ownerType, ownerId, keyName, requestLimit } = req.body;

    if (!ownerType || !['student', 'teacher', 'admin'].includes(ownerType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Valid ownerType is required (student, teacher, or admin).'
      });
    }

    const numericLimit = parseInt(requestLimit || '100', 10);
    if (isNaN(numericLimit) || numericLimit <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'requestLimit must be a positive integer.'
      });
    }

    let parsedOwnerId = null;
    let ownerDisplayName = 'Administrator';

    if (ownerType === 'student') {
      if (!ownerId) {
        return res.status(400).json({ error: 'Bad Request', message: 'ownerId is required for student key.' });
      }
      parsedOwnerId = parseInt(ownerId, 10);
      const [students] = await pool.execute('SELECT id, full_name, student_number FROM students WHERE id = ?', [parsedOwnerId]);
      if (students.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: `Student with ID ${parsedOwnerId} does not exist.` });
      }
      ownerDisplayName = `${students[0].full_name} (${students[0].student_number})`;
    } else if (ownerType === 'teacher') {
      if (!ownerId) {
        return res.status(400).json({ error: 'Bad Request', message: 'ownerId is required for teacher key.' });
      }
      parsedOwnerId = parseInt(ownerId, 10);
      const [teachers] = await pool.execute('SELECT id, full_name, teacher_number FROM teachers WHERE id = ?', [parsedOwnerId]);
      if (teachers.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: `Teacher with ID ${parsedOwnerId} does not exist.` });
      }
      ownerDisplayName = `${teachers[0].full_name} (${teachers[0].teacher_number})`;
    }

    const generated = await keyService.createApiKey({
      ownerType,
      ownerId: parsedOwnerId,
      keyName: keyName || `${ownerDisplayName} API Key`,
      requestLimit: numericLimit
    });

    return res.status(201).json({
      success: true,
      message: 'API Key generated successfully. Please copy it immediately as it will not be displayed again.',
      rawKey: generated.rawKey, // Returned ONCE upon generation
      keyRecord: generated.keyRecord
    });
  } catch (error) {
    console.error('Generate Key Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate API key.' });
  }
}

/**
 * PATCH /api/admin/api-keys/:id/limit
 * Update API request limit
 */
async function updateLimit(req, res) {
  try {
    const keyId = parseInt(req.params.id, 10);
    const { requestLimit } = req.body;

    if (isNaN(keyId) || keyId <= 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid key ID.' });
    }

    const limitNum = parseInt(requestLimit, 10);
    if (isNaN(limitNum) || limitNum <= 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'requestLimit must be a positive integer.' });
    }

    const [keyRows] = await pool.execute('SELECT id, status FROM api_keys WHERE id = ?', [keyId]);
    if (keyRows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'API key not found.' });
    }

    await keyService.updateLimit(keyId, limitNum);

    return res.json({
      success: true,
      message: `Request limit updated to ${limitNum} successfully.`,
      keyId,
      newLimit: limitNum
    });
  } catch (error) {
    console.error('Update Limit Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update request limit.' });
  }
}

/**
 * PATCH /api/admin/api-keys/:id/revoke
 * Immediately revoke an API key
 */
async function revokeKey(req, res) {
  try {
    const keyId = parseInt(req.params.id, 10);

    if (isNaN(keyId) || keyId <= 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid key ID.' });
    }

    const [keyRows] = await pool.execute('SELECT id, status, key_prefix FROM api_keys WHERE id = ?', [keyId]);
    if (keyRows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'API key not found.' });
    }

    if (keyRows[0].status === 'revoked') {
      return res.status(400).json({ error: 'Bad Request', message: 'This API key is already revoked.' });
    }

    await keyService.revokeKey(keyId);

    return res.json({
      success: true,
      message: `API key (${keyRows[0].key_prefix}) has been revoked immediately.`,
      keyId,
      status: 'revoked'
    });
  } catch (error) {
    console.error('Revoke Key Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to revoke API key.' });
  }
}

/**
 * GET /api/admin/logs
 * View audit request logs with filtering
 */
async function getLogs(req, res) {
  try {
    const { status = '', method = '', search = '', limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    let query = `
      SELECT 
        l.id, 
        l.api_key_id, 
        l.endpoint, 
        l.http_method, 
        l.response_status, 
        l.requested_at,
        k.key_prefix, 
        k.owner_type,
        k.key_name
      FROM api_request_logs l
      LEFT JOIN api_keys k ON l.api_key_id = k.id
      WHERE 1=1
    `;
    const params = [];

    if (status.trim() && !isNaN(parseInt(status, 10))) {
      query += ' AND l.response_status = ?';
      params.push(parseInt(status, 10));
    }

    if (method.trim()) {
      query += ' AND l.http_method = ?';
      params.push(method.trim().toUpperCase());
    }

    if (search.trim()) {
      query += ' AND (l.endpoint LIKE ? OR k.key_prefix LIKE ? OR k.key_name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY l.requested_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offsetNum);

    const [logs] = await pool.query(query, params);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM api_request_logs');

    return res.json({
      success: true,
      total,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Admin Logs Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve logs.' });
  }
}

module.exports = {
  getStats,
  getStudents,
  getTeachers,
  getApiKeys,
  generateApiKey,
  updateLimit,
  revokeKey,
  getLogs
};
