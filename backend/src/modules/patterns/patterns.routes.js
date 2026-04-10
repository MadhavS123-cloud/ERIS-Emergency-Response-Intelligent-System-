import { Router } from 'express';
import patternsController from './patterns.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

// Only admin and hospital staff can view pattern analysis
router.get('/anomalies', restrictTo('ADMIN', 'HOSPITAL'), patternsController.getAnomalies);
router.get('/trends', restrictTo('ADMIN', 'HOSPITAL'), patternsController.getTrends);

export default router;
