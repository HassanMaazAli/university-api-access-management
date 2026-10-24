const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Validate key endpoint for settings
router.post('/validate-key', authController.validateKey);

module.exports = router;
