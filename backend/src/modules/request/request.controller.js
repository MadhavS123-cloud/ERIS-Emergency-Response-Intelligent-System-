import requestService from './request.service.js';
import APIResponse from '../../utils/response.js';

class RequestController {
  async createRequest(req, res, next) {
    try {
      const request = await requestService.createRequest(req.user.id, req.body);
      return APIResponse.success(res, request, 'Emergency request created successfully and added to queue', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAllRequests(req, res, next) {
    try {
      const requests = await requestService.getAllRequests(req.user);
      return APIResponse.success(res, requests, 'Requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMyRequests(req, res, next) {
    try {
      const requests = await requestService.getUserRequests(req.user.id);
      return APIResponse.success(res, requests, 'User requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMyDriverRequests(req, res, next) {
    try {
      const requests = await requestService.getDriverRequests(req.user.id);
      return APIResponse.success(res, requests, 'Driver requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getRequest(req, res, next) {
    try {
      const request = await requestService.getRequestById(req.params.id);
      return APIResponse.success(res, request, 'Request retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateRequestStatus(req, res, next) {
    try {
      const request = await requestService.updateRequestStatus(req.params.id, req.body.status, req.user, {
        ambulanceId: req.body.ambulanceId || null,
        driverFeedback: req.body.driverFeedback || null
      });
      return APIResponse.success(res, request, 'Request status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async createGuestEmergency(req, res, next) {
    try {
      const data = {
        ...req.body,
        isGuest: true,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        deviceId: req.headers['x-device-id'] || req.body.deviceId,
        isSuspicious: req.isSuspicious || false,
        suspiciousReason: req.suspiciousReason || null
      };
      
      const request = await requestService.createGuestEmergency(data);
      return APIResponse.success(res, request, 'Emergency request created automatically', 201);
    } catch (error) {
      next(error);
    }
  }

  async verifyGuestOtp(req, res, next) {
    try {
      const { requestId, phone, otp } = req.body;
      if (!requestId || !phone) {
        throw Object.assign(new Error('Request ID and Phone number are required'), { statusCode: 400 });
      }
      // OTP is theoretically verified here
      const request = await requestService.linkPhoneToRequest(requestId, phone);
      return APIResponse.success(res, request, 'Phone number linked to request', 200);
    } catch (error) {
      next(error);
    }
  }

  async getGuestEmergency(req, res, next) {
    try {
      const request = await requestService.getRequestById(req.params.id);
      return APIResponse.success(res, request, 'Guest request retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new RequestController();
