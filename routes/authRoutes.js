const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateApiKey } = require('../middleware/authMiddleware');

router.post('/validate', authController.validateKey);
router.get('/me', authenticateApiKey, authController.getMe);

module.exports = router;
