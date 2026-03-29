import Joi from 'joi';

const createAmbulanceSchema = Joi.object({
  driverId: Joi.string().uuid().required(),
  hospitalId: Joi.string().required(),
  plateNumber: Joi.string().required(),
  locationLat: Joi.number().optional(),
  locationLng: Joi.number().optional(),
  isAvailable: Joi.boolean().optional()
});

const updateAmbulanceSchema = Joi.object({
  hospitalId: Joi.string().optional(),
  plateNumber: Joi.string().optional(),
  locationLat: Joi.number().optional(),
  locationLng: Joi.number().optional(),
  isAvailable: Joi.boolean().optional()
});

export { createAmbulanceSchema, updateAmbulanceSchema };
