import hospitalService from './hospital.service.js';
import APIResponse from '../../utils/response.js';

class HospitalController {
  async createHospital(req, res, next) {
    try {
      const hospital = await hospitalService.createHospital(req.body);
      return APIResponse.success(res, hospital, 'Hospital created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAllHospitals(req, res, next) {
    try {
      const hospitals = await hospitalService.getAllHospitals();
      return APIResponse.success(res, hospitals, 'Hospitals retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getHospital(req, res, next) {
    try {
      const hospital = await hospitalService.getHospitalById(req.params.id);
      return APIResponse.success(res, hospital, 'Hospital retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateHospital(req, res, next) {
    try {
      const hospital = await hospitalService.updateHospital(req.params.id, req.body);
      return APIResponse.success(res, hospital, 'Hospital updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteHospital(req, res, next) {
    try {
      await hospitalService.deleteHospital(req.params.id);
      return res.status(204).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  }
}

export default new HospitalController();
