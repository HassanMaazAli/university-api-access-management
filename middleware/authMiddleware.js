const { pool } = require('../config/db');
const { getKeyDetailsByRawKey, hashKey } = require('../services/keyService');

/**
 * Global API Request Logger
 * Safely inserts logs on response finish without blocking the request
 */
function logRequest(apiKeyId, endpoint, method, statusCode) {
  // Asynchronously log to api_request_logs
  pool.execute(
    `INSERT INTO api_request_logs (api_key_id, endpoint, http_method, response_status, requested_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [apiKeyId || null, endpoint.slice(0, 255), method.slice(0, 10), statusCode]
  ).catch(err => {
    console.error('Failed to log API request:', err.message);
  });
}

/**
 * Authentication Middleware
 * 1. Checks header `x-api-key`
 * 2. Rejects query parameter API keys for security
 * 3. Hashes and validates against database
 * 4. Checks revoked status (403)
 * 5. Atomically checks and increments request quota (429)
 * 6. Records audit log on response completion
 */
async function authenticateApiKey(req, res, next) {
  // Reject keys provided in URL query parameters
  if (req.query.api_key || req.query.apiKey || req.query.key) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'For security reasons, API keys must be provided in the x-api-key HTTP header, not in query parameters.'
    });
  }

  const rawKey = req.headers['x-api-key'] || req.headers['X-API-KEY'];

  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim() === '') {
    res.on('finish', () => {
      logRequest(null, req.originalUrl || req.url, req.method, res.statusCode);
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or empty x-api-key HTTP header.'
    });
  }

  try {
    const keyData = await getKeyDetailsByRawKey(rawKey.trim());

    if (!keyData) {
      res.on('finish', () => {
        logRequest(null, req.originalUrl || req.url, req.method, res.statusCode);
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key.'
      });
    }

    // Attach response log listener with key ID
    res.on('finish', () => {
      logRequest(keyData.id, req.originalUrl || req.url, req.method, res.statusCode);
    });

    // Check Revocation Status
    if (keyData.status === 'revoked') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This API key has been revoked and is no longer active.',
        revokedAt: keyData.revoked_at
      });
    }

    // Check Request Quota
    if (keyData.request_count >= keyData.request_limit) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `API request quota exceeded. Limit: ${keyData.request_limit}, Used: ${keyData.request_count}`,
        quota: {
          limit: keyData.request_limit,
          used: keyData.request_count,
          remaining: 0
        }
      });
    }

    // Atomic increment of request_count
    const [updateResult] = await pool.execute(
      `UPDATE api_keys 
       SET request_count = request_count + 1, last_used_at = NOW() 
       WHERE id = ? AND request_count < request_limit`,
      [keyData.id]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'API request quota exceeded (concurrent limit reached).',
        quota: {
          limit: keyData.request_limit,
          used: keyData.request_limit,
          remaining: 0
        }
      });
    }

    // Attach authenticated identity to request object
    req.auth = {
      keyId: keyData.id,
      ownerType: keyData.owner_type,
      ownerId: keyData.owner_id,
      keyPrefix: keyData.key_prefix,
      keyName: keyData.key_name,
      requestLimit: keyData.request_limit,
      requestCount: keyData.request_count + 1,
      remaining: Math.max(0, keyData.request_limit - (keyData.request_count + 1)),
      owner: keyData.owner
    };

    next();
  } catch (error) {
    console.error('Authentication Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process API key authentication.'
    });
  }
}

module.exports = {
  authenticateApiKey,
  logRequest
};
