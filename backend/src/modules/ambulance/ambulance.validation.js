const Joi = require('joi');

const createAmbulanceSchema = Joi.object({
  driverId: Joi.string().uuid().required(),
  plateNumber: Joi.string().required(),
  locationLat: Joi.number().optional(),
  locationLng: Joi.number().optional(),
  isAvailable: Joi.boolean().optional()
});

const updateAmbulanceSchema = Joi.object({
  plateNumber: Joi.string().optional(),
  locationLat: Joi.number().optional(),
  locationLng: Joi.number().optional(),
  isAvailable: Joi.boolean().optional()
});

module.exports = {
  createAmbulanceSchema,
  updateAmbulanceSchema
};
