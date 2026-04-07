import Joi from 'joi';

const createRequestSchema = Joi.object({
  emergencyType: Joi.string().required(),
  pickupAddress: Joi.string().required(),
  medicalNotes: Joi.string().allow('', null),
  locationLat: Joi.number().required(),
  locationLng: Joi.number().required(),
  patientName: Joi.string().required(),
  patientPhone: Joi.string().allow('', null)
});

const updateRequestStatusSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED').required(),
  ambulanceId: Joi.string().optional().allow(null, '')
});

export { createRequestSchema, updateRequestStatusSchema };
