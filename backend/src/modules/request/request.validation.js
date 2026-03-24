const Joi = require('joi');

const createRequestSchema = Joi.object({
  locationLat: Joi.number().required(),
  locationLng: Joi.number().required()
});

const updateRequestStatusSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'ACCEPTED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED').required()
});

module.exports = {
  createRequestSchema,
  updateRequestStatusSchema
};
