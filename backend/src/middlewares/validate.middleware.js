const APIResponse = require('../utils/response');

const validate = (schema) => (req, res, next) => {
  const { value, error } = schema.validate(req.body, { abortEarly: false });
  
  if (error) {
    const errorMessages = error.details.map((details) => details.message);
    return APIResponse.error(res, 'Validation Error', 400, errorMessages);
  }
  
  Object.assign(req, value);
  return next();
};

module.exports = { validate };
