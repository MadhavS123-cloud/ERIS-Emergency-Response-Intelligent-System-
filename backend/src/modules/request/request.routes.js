import { Router } from 'express';
import requestController from './request.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createRequestSchema, updateRequestStatusSchema } from './request.validation.js';

const router = Router();

router.use(protect);

// Patients can create and view their requests
router.post('/', restrictTo('PATIENT'), validate(createRequestSchema), requestController.createRequest);
router.get('/me', restrictTo('PATIENT'), requestController.getMyRequests);

// Drivers can update request status
router.patch('/:id/status', restrictTo('DRIVER', 'ADMIN'), validate(updateRequestStatusSchema), requestController.updateRequestStatus);

router.get('/:id', requestController.getRequest);

// Only admins can see all requests
router.get('/', restrictTo('ADMIN'), requestController.getAllRequests);

export default router;
