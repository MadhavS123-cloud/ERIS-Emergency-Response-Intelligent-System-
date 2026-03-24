const trackingService = require('./tracking.service');
const APIResponse = require('../../utils/response');

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

module.exports = new TrackingController();
