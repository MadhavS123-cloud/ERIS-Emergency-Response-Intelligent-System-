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
router.get('/driver/me', restrictTo('DRIVER'), requestController.getMyDriverRequests);

// Staff can update request status
router.patch('/:id/status', restrictTo('DRIVER', 'ADMIN', 'HOSPITAL'), validate(updateRequestStatusSchema), requestController.updateRequestStatus);

router.get('/:id', requestController.getRequest);

// Staff dashboards need access to the live request queue
router.get('/', restrictTo('ADMIN', 'HOSPITAL'), requestController.getAllRequests);

export default router;
