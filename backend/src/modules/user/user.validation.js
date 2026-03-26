import Joi from 'joi';

const updateUserSchema = Joi.object({
  name: Joi.string().min(3).optional(),
  phone: Joi.string().optional(),
});

export { updateUserSchema };
