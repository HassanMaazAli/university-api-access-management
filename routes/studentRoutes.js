const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateApiKey } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All student routes require valid student API key
router.use(authenticateApiKey);
router.use(requireRole('student'));

router.get('/profile', studentController.getProfile);
router.get('/marks', studentController.getMarks);

module.exports = router;
