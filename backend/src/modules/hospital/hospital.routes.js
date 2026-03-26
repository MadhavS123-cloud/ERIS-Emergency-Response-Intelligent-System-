import { Router } from 'express';
import hospitalController from './hospital.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createHospitalSchema, updateHospitalSchema } from './hospital.validation.js';

const router = Router();

router.use(protect);

router.get('/', hospitalController.getAllHospitals);
router.get('/:id', hospitalController.getHospital);

// Restrict to admins
router.use(restrictTo('ADMIN'));

router.post('/', validate(createHospitalSchema), hospitalController.createHospital);
router.patch('/:id', validate(updateHospitalSchema), hospitalController.updateHospital);
router.delete('/:id', hospitalController.deleteHospital);

export default router;
