const express = require('express');
const adminController = require('./admin.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');

const router = express.Router();

// Only admins can access these routes
router.use(protect);
router.use(restrictTo('ADMIN'));

router.get('/dashboard-stats', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers);
router.get('/requests', adminController.getAllRequests);

module.exports = router;
