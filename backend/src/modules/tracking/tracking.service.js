import ambulanceRepository from '../ambulance/ambulance.repository.js';
import { prisma } from '../../config/db.js';
import { getIO } from '../../services/socket.service.js';

class TrackingService {
  async updateLocation(driverId, locationLat, locationLng) {
    const ambulances = await ambulanceRepository.findAllAmbulances();
    const ambulance = ambulances.find(a => a.driverId === driverId);

    if (!ambulance) {
      throw Object.assign(new Error('Ambulance not found for this driver'), { statusCode: 404 });
    }

    // Update ambulance location in DB
    const updatedAmbulance = await ambulanceRepository.updateAmbulance(ambulance.id, {
      locationLat,
      locationLng
    });

    // Find the active request assigned to this ambulance so we can target the right room
    const activeRequest = await prisma.request.findFirst({
      where: {
        ambulanceId: ambulance.id,
        status: { in: ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_TRANSIT'] }
      },
      select: { id: true, patientId: true }
    });

    const io = getIO();
    const locationPayload = {
      ambulanceId: ambulance.id,
      driverId,
      locationLat,
      locationLng,
      requestId: activeRequest?.id || null,
    };

    // Broadcast globally for hospital fleet map
    io.emit('location_update', locationPayload);

    // Targeted delivery to the patient tracking page
    if (activeRequest?.id) {
      io.to(`request:${activeRequest.id}`).emit('ambulance_location_update', locationPayload);
    }

    return updatedAmbulance;
  }
}

export default new TrackingService();
