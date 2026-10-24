const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticateApiKey } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All teacher routes require valid teacher API key
router.use(authenticateApiKey);
router.use(requireRole('teacher'));

router.get('/profile', teacherController.getProfile);
router.get('/students', teacherController.getAllStudents);
router.get('/marks', teacherController.getAllMarks);

module.exports = router;
