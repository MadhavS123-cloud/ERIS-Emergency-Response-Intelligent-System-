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
        ambulanceId: req.body.ambulanceId || null
      });
      return APIResponse.success(res, request, 'Request status updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new RequestController();
