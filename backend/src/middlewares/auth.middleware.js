const jwt = require('jsonwebtoken');
const APIResponse = require('../utils/response');

const protect = (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return APIResponse.error(res, 'You are not logged in! Please log in to get access.', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // The user object embedded in token
    next();
  } catch (err) {
    next(err);
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return APIResponse.error(res, 'You do not have permission to perform this action', 403);
    }
    next();
  };
};

module.exports = { protect, restrictTo };
