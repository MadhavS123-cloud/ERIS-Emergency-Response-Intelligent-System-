const express = require('express');
const userController = require('./user.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { updateUserSchema } = require('./user.validation');

const router = express.Router();

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

module.exports = router;
