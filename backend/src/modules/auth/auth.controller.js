import authService from './auth.service.js';
import APIResponse from '../../utils/response.js';

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

  async createPatientSession(req, res, next) {
    try {
      const data = await authService.createPatientSession(req.body);
      return APIResponse.success(res, data, 'Patient session ready', 200);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const user = await authService.resetUserPassword(req.body);
      return APIResponse.success(res, user, 'Password reset successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
