const Joi = require('joi');

const updateUserSchema = Joi.object({
  name: Joi.string().min(3).optional(),
  phone: Joi.string().optional(),
});

module.exports = {
  updateUserSchema
};
