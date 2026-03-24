const express = require('express');
const hospitalController = require('./hospital.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { createHospitalSchema, updateHospitalSchema } = require('./hospital.validation');

const router = express.Router();

router.use(protect);

router.get('/', hospitalController.getAllHospitals);
router.get('/:id', hospitalController.getHospital);

// Restrict to admins
router.use(restrictTo('ADMIN'));

router.post('/', validate(createHospitalSchema), hospitalController.createHospital);
router.patch('/:id', validate(updateHospitalSchema), hospitalController.updateHospital);
router.delete('/:id', hospitalController.deleteHospital);

module.exports = router;
