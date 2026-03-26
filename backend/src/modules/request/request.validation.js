import Joi from 'joi';

const createRequestSchema = Joi.object({
  locationLat: Joi.number().required(),
  locationLng: Joi.number().required()
});

const updateRequestStatusSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'ACCEPTED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED').required()
});

export { createRequestSchema, updateRequestStatusSchema };
