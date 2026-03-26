import ambulanceRepository from '../ambulance/ambulance.repository.js';
import { getIO } from '../../services/socket.service.js';

class TrackingService {
  async updateLocation(driverId, locationLat, locationLng) {
    // Attempt to find the ambulance
    const ambulances = await ambulanceRepository.findAllAmbulances();
    const ambulance = ambulances.find(a => a.driverId === driverId);

    if (!ambulance) {
      throw Object.assign(new Error('Ambulance not found for this driver'), { statusCode: 404 });
    }

    // Update location
    const updatedAmbulance = await ambulanceRepository.updateAmbulance(ambulance.id, {
      locationLat,
      locationLng
    });

    // Fire socket event to active listeners
    const io = getIO();
    io.emit('location_update', {
      ambulanceId: ambulance.id,
      driverId,
      locationLat,
      locationLng
    });

    return updatedAmbulance;
  }
}

export default new TrackingService();
