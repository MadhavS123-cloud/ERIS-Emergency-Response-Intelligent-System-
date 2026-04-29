import { Router } from 'express';
import adminController from './admin.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';

const router = Router();

// Allow Dashboard App to fetch stats using an internal secret
router.get('/dashboard-stats', (req, res, next) => {
  if (req.headers['x-internal-token'] === 'ERIS_INTERNAL') {
    return adminController.getDashboardStats(req, res, next);
  }
  next();
});

// Staff accounts — accessible by internal token for the admin dashboard
router.get('/staff-accounts', (req, res, next) => {
  if (req.headers['x-internal-token'] === 'ERIS_INTERNAL') {
    return adminController.getStaffAccounts(req, res, next);
  }
  next();
});

router.post('/staff-accounts/reset-password', (req, res, next) => {
  if (req.headers['x-internal-token'] === 'ERIS_INTERNAL') {
    return adminController.resetStaffPassword(req, res, next);
  }
  next();
});

// Only admins can access these routes
router.use(protect);
router.use(restrictTo('ADMIN'));

router.get('/dashboard-stats', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers);
router.get('/requests', adminController.getAllRequests);
router.get('/devices', adminController.getDeviceTrustList);
router.patch('/devices/:deviceId/blacklist', adminController.setDeviceBlacklist);
router.get('/suspicious', adminController.getSuspiciousRequests);
router.get('/staff-accounts', adminController.getStaffAccounts);
router.post('/staff-accounts/reset-password', adminController.resetStaffPassword);

export default router;
