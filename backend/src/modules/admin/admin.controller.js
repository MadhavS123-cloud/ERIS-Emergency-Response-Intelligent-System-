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

  async getDeviceTrustList(req, res, next) {
    try {
      const list = await adminService.getDeviceTrustList();
      return APIResponse.success(res, list, 'Device trust list retrieved');
    } catch (error) {
      next(error);
    }
  }

  async setDeviceBlacklist(req, res, next) {
    try {
      const { deviceId } = req.params;
      const { blacklisted } = req.body;
      if (typeof blacklisted !== 'boolean') {
        return res.status(400).json({ status: 'fail', message: 'blacklisted must be a boolean' });
      }
      const result = await adminService.setDeviceBlacklist(deviceId, blacklisted);
      return APIResponse.success(res, result, `Device ${blacklisted ? 'blacklisted' : 'unblacklisted'} successfully`);
    } catch (error) {
      next(error);
    }
  }

  async getSuspiciousRequests(req, res, next) {
    try {
      const requests = await adminService.getSuspiciousRequests();
      return APIResponse.success(res, requests, 'Suspicious requests retrieved');
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
