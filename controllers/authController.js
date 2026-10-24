const { getKeyDetailsByRawKey } = require('../services/keyService');

/**
 * Validate an API Key (Used by Settings page and verification)
 * POST /api/auth/validate and POST /api/settings/validate-key
 */
async function validateKey(req, res) {
  // Support key from body or header
  const rawKey = req.body.apiKey || req.headers['x-api-key'] || req.headers['X-API-KEY'];

  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim() === '') {
    return res.status(400).json({
      valid: false,
      error: 'Bad Request',
      message: 'Please provide an API key to validate.'
    });
  }

  try {
    const keyData = await getKeyDetailsByRawKey(rawKey.trim());

    if (!keyData) {
      return res.status(401).json({
        valid: false,
        error: 'Unauthorized',
        message: 'Invalid API key. No matching key record found.'
      });
    }

    if (keyData.status === 'revoked') {
      return res.status(403).json({
        valid: false,
        error: 'Forbidden',
        status: 'revoked',
        message: 'This API key has been revoked and can no longer be used.',
        revokedAt: keyData.revoked_at
      });
    }

    const quotaExceeded = keyData.request_count >= keyData.request_limit;

    return res.status(200).json({
      valid: true,
      status: keyData.status,
      ownerType: keyData.owner_type,
      ownerId: keyData.owner_id,
      keyPrefix: keyData.key_prefix,
      keyName: keyData.key_name,
      requestLimit: keyData.request_limit,
      requestCount: keyData.request_count,
      remaining: Math.max(0, keyData.request_limit - keyData.request_count),
      quotaExceeded,
      owner: keyData.owner
    });
  } catch (error) {
    console.error('Key Validation Error:', error);
    return res.status(500).json({
      valid: false,
      error: 'Internal Server Error',
      message: 'Failed to validate API key.'
    });
  }
}

/**
 * Get current authenticated user details
 * GET /api/auth/me
 */
async function getMe(req, res) {
  if (!req.auth) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
  }

  return res.json({
    authenticated: true,
    auth: req.auth
  });
}

module.exports = {
  validateKey,
  getMe
};
