import { Router } from 'express';
import forecastsController from './forecasts.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

// Only admin and hospital staff can view forecasts
router.get('/demand', restrictTo('ADMIN', 'HOSPITAL'), forecastsController.getDemandForecast);

export default router;
