import { Router } from 'express';
import ambulanceController from './ambulance.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createAmbulanceSchema, updateAmbulanceSchema } from './ambulance.validation.js';

const router = Router();

router.use(protect);

router.get('/', ambulanceController.getAllAmbulances);
router.get('/:id', ambulanceController.getAmbulance);

// Restrict to admins and hospitals for fleet management
router.use(restrictTo('ADMIN', 'HOSPITAL'));

router.post('/', validate(createAmbulanceSchema), ambulanceController.createAmbulance);
router.patch('/:id', validate(updateAmbulanceSchema), ambulanceController.updateAmbulance);
router.delete('/:id', ambulanceController.deleteAmbulance);

export default router;
