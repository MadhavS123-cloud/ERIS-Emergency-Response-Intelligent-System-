import ambulanceService from './ambulance.service.js';
import APIResponse from '../../utils/response.js';

class AmbulanceController {
  async createAmbulance(req, res, next) {
    try {
      const ambulance = await ambulanceService.createAmbulance(req.body);
      return APIResponse.success(res, ambulance, 'Ambulance created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAllAmbulances(req, res, next) {
    try {
      const ambulances = await ambulanceService.getAllAmbulances();
      return APIResponse.success(res, ambulances, 'Ambulances retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAmbulance(req, res, next) {
    try {
      const ambulance = await ambulanceService.getAmbulanceById(req.params.id);
      return APIResponse.success(res, ambulance, 'Ambulance retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateAmbulance(req, res, next) {
    try {
      const ambulance = await ambulanceService.updateAmbulance(req.params.id, req.body);
      return APIResponse.success(res, ambulance, 'Ambulance updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteAmbulance(req, res, next) {
    try {
      await ambulanceService.deleteAmbulance(req.params.id);
      return res.status(204).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  }
}

export default new AmbulanceController();
