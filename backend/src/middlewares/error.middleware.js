const logger = require('../utils/logger');
const APIResponse = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.name}: ${err.message}`);
  logger.error(err.stack);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Prisma errors
  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'Duplicate field value entered';
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again!';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your token has expired! Please log in again.';
  }

  if (process.env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      status: 'error',
      message,
      error: err,
      stack: err.stack
    });
  }

  return APIResponse.error(res, message, statusCode);
};

module.exports = { errorHandler };
