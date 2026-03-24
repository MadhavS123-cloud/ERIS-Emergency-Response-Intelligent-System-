const authService = require('./auth.service');
const APIResponse = require('../../utils/response');

class AuthController {
  async register(req, res, next) {
    try {
      const data = await authService.registerUser(req.body);
      return APIResponse.success(res, data, 'User registered successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const data = await authService.loginUser(email, password);
      return APIResponse.success(res, data, 'Login successful', 200);
    } catch (error) {
      next(error);
    }
  }

  // Placeholder for logout, refresh token, etc.
}

module.exports = new AuthController();
