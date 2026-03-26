import trackingService from './tracking.service.js';
import APIResponse from '../../utils/response.js';

class TrackingController {
  async updateLocation(req, res, next) {
    try {
      const { locationLat, locationLng } = req.body;
      const driverId = req.user.id; // user must be DRIVER

      const updatedAmbulance = await trackingService.updateLocation(driverId, locationLat, locationLng);
      return APIResponse.success(res, updatedAmbulance, 'Location updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new TrackingController();
