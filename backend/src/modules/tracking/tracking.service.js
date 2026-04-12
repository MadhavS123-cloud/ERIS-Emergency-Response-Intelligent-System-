import ambulanceRepository from '../ambulance/ambulance.repository.js';
import { prisma } from '../../config/db.js';
import { getIO } from '../../services/socket.service.js';
import logger from '../../utils/logger.js';

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
      select: { 
        id: true, 
        patientId: true,
        locationLat: true,
        locationLng: true
      }
    });

    const io = getIO();
    
    // Include hospital location for full route tracking (hospital → patient → hospital)
    const hospital = ambulance.hospital;
    const locationPayload = {
      ambulanceId: ambulance.id,
      driverId,
      locationLat,
      locationLng,
      requestId: activeRequest?.id || null,
      // Add hospital location for full route display
      hospitalLat: hospital?.locationLat || null,
      hospitalLng: hospital?.locationLng || null,
      hospitalName: hospital?.name || null,
      // Add patient location for route display
      patientLat: activeRequest?.locationLat || null,
      patientLng: activeRequest?.locationLng || null
    };

    // Broadcast globally for hospital fleet map
    io.emit('location_update', locationPayload);

    // Targeted delivery to the patient tracking page
    if (activeRequest?.id) {
      io.to(`request:${activeRequest.id}`).emit('ambulance_location_update', locationPayload);
    }

    logger.info(`Ambulance ${ambulance.id} location updated to (${locationLat}, ${locationLng}). Full route: Hospital (${hospital?.locationLat}, ${hospital?.locationLng}) → Ambulance (${locationLat}, ${locationLng}) → Patient (${activeRequest?.locationLat}, ${activeRequest?.locationLng})`);

    return updatedAmbulance;
  }
}

export default new TrackingService();
