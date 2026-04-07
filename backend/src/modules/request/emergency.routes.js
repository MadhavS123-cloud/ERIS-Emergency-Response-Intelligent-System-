import { Router } from 'express';
import requestController from './request.controller.js';
import { emergencyRateLimiter } from '../../middlewares/rateLimit.middleware.js';

const router = Router();

// Guest emergency request Endpoint
// Bypasses JWT auth (`protect`).
// Rate limited (but doesn't block, just flags).
router.post(
  '/',
  emergencyRateLimiter,
  requestController.createGuestEmergency
);

// Soft Identity verification (OTP submission)
router.post(
  '/otp',
  requestController.verifyGuestOtp
);

router.get(
  '/:id',
  requestController.getGuestEmergency
);

export default router;
