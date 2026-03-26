import Joi from 'joi';

const createHospitalSchema = Joi.object({
  adminId: Joi.string().uuid().required(),
  name: Joi.string().required(),
  address: Joi.string().required(),
  locationLat: Joi.number().optional(),
  locationLng: Joi.number().optional(),
  bedCapacity: Joi.number().integer().min(0).optional()
});

const updateHospitalSchema = Joi.object({
  name: Joi.string().optional(),
  address: Joi.string().optional(),
  locationLat: Joi.number().optional(),
  locationLng: Joi.number().optional(),
  bedCapacity: Joi.number().integer().min(0).optional()
});

export { createHospitalSchema, updateHospitalSchema };
