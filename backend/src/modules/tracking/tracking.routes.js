const express = require('express');
const trackingController = require('./tracking.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

// Only driver can broadcast location
router.post('/location', restrictTo('DRIVER'), trackingController.updateLocation);

module.exports = router;
