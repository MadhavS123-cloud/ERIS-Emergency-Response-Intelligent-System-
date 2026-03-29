import { Router } from 'express';
import authController from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { registerSchema, loginSchema, patientSessionSchema, resetPasswordSchema } from './auth.validation.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/patient-session', validate(patientSessionSchema), authController.createPatientSession);
router.patch('/reset-password', protect, restrictTo('ADMIN'), validate(resetPasswordSchema), authController.resetPassword);

export default router;
