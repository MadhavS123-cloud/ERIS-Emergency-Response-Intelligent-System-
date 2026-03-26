import { Router } from 'express';
import trackingController from './tracking.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

// Only driver can broadcast location
router.post('/location', restrictTo('DRIVER'), trackingController.updateLocation);

export default router;
