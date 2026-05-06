import Joi from 'joi';

const registerSchema = Joi.object({
  name: Joi.string().required().min(3),
  email: Joi.string().email({ tlds: { allow: false } }).required().lowercase().trim(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('PATIENT', 'DRIVER', 'HOSPITAL', 'ADMIN').optional(),
  phone: Joi.string().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().required().lowercase().trim(),
  password: Joi.string().required()
});

const patientSessionSchema = Joi.object({
  name: Joi.string().required().min(3),
  phone: Joi.string().required().min(10),
  email: Joi.string().email({ tlds: { allow: false } }).optional().lowercase().trim()
});

const resetPasswordSchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  email: Joi.string().optional().lowercase().trim(),
  newPassword: Joi.string().min(6).required()
}).or('userId', 'email');

export { registerSchema, loginSchema, patientSessionSchema, resetPasswordSchema };
