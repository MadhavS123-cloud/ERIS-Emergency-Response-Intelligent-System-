const express = require('express');
const ambulanceController = require('./ambulance.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { createAmbulanceSchema, updateAmbulanceSchema } = require('./ambulance.validation');

const router = express.Router();

router.use(protect);

router.get('/', ambulanceController.getAllAmbulances);
router.get('/:id', ambulanceController.getAmbulance);

// Restrict to admins and hospitals for fleet management
router.use(restrictTo('ADMIN', 'HOSPITAL'));

router.post('/', validate(createAmbulanceSchema), ambulanceController.createAmbulance);
router.patch('/:id', validate(updateAmbulanceSchema), ambulanceController.updateAmbulance);
router.delete('/:id', ambulanceController.deleteAmbulance);

module.exports = router;
