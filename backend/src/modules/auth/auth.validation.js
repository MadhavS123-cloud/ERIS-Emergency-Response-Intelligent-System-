const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().required().min(3),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('PATIENT', 'DRIVER', 'HOSPITAL', 'ADMIN').optional(),
  phone: Joi.string().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

module.exports = {
  registerSchema,
  loginSchema
};
