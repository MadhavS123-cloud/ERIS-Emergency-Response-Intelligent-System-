import { Router } from 'express';
import userController from './user.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { updateUserSchema } from './user.validation.js';

const router = Router();

// Protect all routes after this middleware
router.use(protect);

router.get('/me', userController.getMe);
router.patch('/me', validate(updateUserSchema), (req, res, next) => {
  req.params.id = req.user.id;
  next();
}, userController.updateUser);

// Only admins can access following routes
router.use(restrictTo('ADMIN'));

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUser);
router.patch('/:id', validate(updateUserSchema), userController.updateUser);
router.delete('/:id', userController.deleteUser);

export default router;
