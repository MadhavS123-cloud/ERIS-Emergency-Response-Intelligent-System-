const express = require('express');
const requestController = require('./request.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { createRequestSchema, updateRequestStatusSchema } = require('./request.validation');

const router = express.Router();

router.use(protect);

// Patients can create and view their requests
router.post('/', restrictTo('PATIENT'), validate(createRequestSchema), requestController.createRequest);
router.get('/me', restrictTo('PATIENT'), requestController.getMyRequests);

// Drivers can update request status
router.patch('/:id/status', restrictTo('DRIVER', 'ADMIN'), validate(updateRequestStatusSchema), requestController.updateRequestStatus);

router.get('/:id', requestController.getRequest);

// Only admins can see all requests
router.get('/', restrictTo('ADMIN'), requestController.getAllRequests);

module.exports = router;
