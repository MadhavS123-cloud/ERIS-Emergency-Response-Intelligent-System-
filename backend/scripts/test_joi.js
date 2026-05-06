import Joi from 'joi';

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().lowercase().trim(),
  password: Joi.string().required()
});

const testData = {
  email: 'driver202@eris.local',
  password: 'password123'
};

const { error, value } = loginSchema.validate(testData);

if (error) {
  console.log('Validation FAILED:');
  console.log(error.details.map(d => d.message));
} else {
  console.log('Validation PASSED:');
  console.log(value);
}
