import APIResponse from '../../utils/response.js';
import adminService from './admin.service.js';

class AdminController {
  async getDashboardStats(req, res, next) {
    try {
      const stats = await adminService.getDashboardStats();
      return APIResponse.success(res, stats, 'Admin dashboard stats retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAllUsers(req, res, next) {
    try {
      const users = await adminService.getAllUsers();
      return APIResponse.success(res, users, 'All users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAllRequests(req, res, next) {
    try {
      const requests = await adminService.getAllRequests();
      return APIResponse.success(res, requests, 'All requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
