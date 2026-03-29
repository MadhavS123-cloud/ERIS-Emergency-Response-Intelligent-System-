import { Router } from 'express';
import hospitalController from './hospital.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createHospitalSchema, updateHospitalSchema } from './hospital.validation.js';

const router = Router();

router.use(protect);

router.get('/', hospitalController.getAllHospitals);
router.get('/:id', hospitalController.getHospital);
router.post('/', restrictTo('ADMIN'), validate(createHospitalSchema), hospitalController.createHospital);
router.patch('/:id', restrictTo('ADMIN', 'HOSPITAL'), validate(updateHospitalSchema), hospitalController.updateHospital);
router.delete('/:id', restrictTo('ADMIN'), hospitalController.deleteHospital);

export default router;
