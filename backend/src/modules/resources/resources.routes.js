import { Router } from 'express';
import resourcesController from './resources.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

// Only admin and hospital staff can view resource recommendations
router.get('/recommendations', restrictTo('ADMIN', 'HOSPITAL'), resourcesController.getRecommendations);

export default router;
