const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateApiKey } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All admin routes are strictly guarded by admin API key authentication and role check
router.use(authenticateApiKey);
router.use(requireRole('admin'));

router.get('/stats', adminController.getStats);
router.get('/students', adminController.getStudents);
router.get('/teachers', adminController.getTeachers);
router.get('/api-keys', adminController.getApiKeys);
router.post('/api-keys', adminController.generateApiKey);
router.patch('/api-keys/:id/limit', adminController.updateLimit);
router.patch('/api-keys/:id/revoke', adminController.revokeKey);
router.get('/logs', adminController.getLogs);

module.exports = router;
