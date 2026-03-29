import requestRepository from './request.repository.js';
import ambulanceRepository from '../ambulance/ambulance.repository.js';
import hospitalRepository from '../hospital/hospital.repository.js';
import { addEmergencyRequestToQueue } from '../../services/queue.service.js';
import { getIO } from '../../services/socket.service.js';
import { calculateDistance } from '../../utils/distance.js';

class RequestService {
  sortAmbulancesByDistance(ambulances, request) {
    return [...ambulances].sort((a, b) => (
      calculateDistance(request.locationLat, request.locationLng, a.locationLat ?? 0, a.locationLng ?? 0) -
      calculateDistance(request.locationLat, request.locationLng, b.locationLat ?? 0, b.locationLng ?? 0)
    ));
  }

  async createRequest(patientId, data) {
    const request = await requestRepository.createRequest({
      patientId,
      locationLat: data.locationLat,
      locationLng: data.locationLng,
      emergencyType: data.emergencyType,
      pickupAddress: data.pickupAddress,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      medicalNotes: data.medicalNotes || '',
      status: 'PENDING'
    });

    await addEmergencyRequestToQueue(request);

    const io = getIO();
    io.emit('new_emergency', request);
    io.emit('request_updated', request);

    return request;
  }

  async getRequestById(id) {
    const request = await requestRepository.findRequestById(id);
    if (!request) {
      throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    }

    return request;
  }

  async getAllRequests(actor) {
    if (actor?.role === 'HOSPITAL') {
      if (!actor.hospitalId) {
        throw Object.assign(new Error('This hospital account is not linked to a facility'), { statusCode: 403 });
      }

      return await requestRepository.findRequestsForHospital(actor.hospitalId);
    }

    return await requestRepository.findAllRequests();
  }

  async getUserRequests(patientId) {
    return await requestRepository.findRequestsByPatientId(patientId);
  }

  async getDriverRequests(driverId) {
    return await requestRepository.findRequestsByDriverId(driverId);
  }

  async assignAmbulance(request, actor, preferredAmbulanceId = null) {
    if (request.ambulanceId || request.driverId) {
      throw Object.assign(new Error('This request already has an ambulance assigned'), { statusCode: 409 });
    }

    if (preferredAmbulanceId) {
      const preferredAmbulance = await ambulanceRepository.findAmbulanceById(preferredAmbulanceId);

      if (!preferredAmbulance) {
        throw Object.assign(new Error('Selected ambulance was not found'), { statusCode: 404 });
      }

      if (!preferredAmbulance.isAvailable) {
        throw Object.assign(new Error('Selected ambulance is no longer available'), { statusCode: 409 });
      }

      if (!preferredAmbulance.driverId) {
        throw Object.assign(new Error('Selected ambulance has no linked driver'), { statusCode: 409 });
      }

      if (actor?.role === 'HOSPITAL' && preferredAmbulance.hospitalId !== actor.hospitalId) {
        throw Object.assign(new Error('You can only assign ambulances from your own hospital fleet'), { statusCode: 403 });
      }

      await ambulanceRepository.updateAmbulance(preferredAmbulance.id, { isAvailable: false });
      return preferredAmbulance;
    }

    let availableAmbulances = [];

    if (actor?.role === 'HOSPITAL') {
      if (!actor.hospitalId) {
        throw Object.assign(new Error('This hospital account is not linked to a facility'), { statusCode: 403 });
      }

      availableAmbulances = await ambulanceRepository.findAvailableAmbulancesByHospitalId(actor.hospitalId);
    } else {
      availableAmbulances = await ambulanceRepository.findAvailableAmbulances();

      const hospitals = await hospitalRepository.findAllHospitals();
      const nearestHospital = hospitals
        .filter(hospital => typeof hospital.locationLat === 'number' && typeof hospital.locationLng === 'number')
        .sort((a, b) => (
          calculateDistance(request.locationLat, request.locationLng, a.locationLat, a.locationLng) -
          calculateDistance(request.locationLat, request.locationLng, b.locationLat, b.locationLng)
        ))[0];

      if (nearestHospital) {
        availableAmbulances = availableAmbulances.filter(
          ambulance => ambulance.hospitalId === nearestHospital.id
        );
      }
    }

    if (availableAmbulances.length === 0) {
      throw Object.assign(new Error('No available ambulances in this hospital fleet'), { statusCode: 409 });
    }

    const selectedAmbulance = this.sortAmbulancesByDistance(availableAmbulances, request)[0];
    await ambulanceRepository.updateAmbulance(selectedAmbulance.id, { isAvailable: false });

    return selectedAmbulance;
  }

  async updateRequestStatus(id, status, actor, options = {}) {
    const request = await this.getRequestById(id);
    const actorRole = actor?.role;
    const requestHospitalId = request.ambulance?.hospital?.id || null;
    const updateData = { status };
    const { ambulanceId = null } = options;

    if (status === 'ACCEPTED') {
      if (!['ADMIN', 'HOSPITAL'].includes(actorRole)) {
        throw Object.assign(new Error('Only hospital staff can assign ambulances'), { statusCode: 403 });
      }

      const assignedAmbulance = await this.assignAmbulance(request, actor, ambulanceId);
      updateData.ambulanceId = assignedAmbulance.id;
      updateData.driverId = assignedAmbulance.driverId;
    }

    if (actorRole === 'DRIVER') {
      if (!['EN_ROUTE', 'COMPLETED'].includes(status)) {
        throw Object.assign(new Error('Drivers can only start navigation or complete handover'), { statusCode: 403 });
      }

      if (!request.driverId || request.driverId !== actor.id) {
        throw Object.assign(new Error('This request is not assigned to you'), { statusCode: 403 });
      }
    }

    if (actorRole === 'HOSPITAL' && requestHospitalId && actor.hospitalId !== requestHospitalId) {
      throw Object.assign(new Error('You can only manage requests assigned to your own hospital'), { statusCode: 403 });
    }

    if (['COMPLETED', 'CANCELLED'].includes(status) && request.ambulanceId) {
      await ambulanceRepository.updateAmbulance(request.ambulanceId, { isAvailable: true });
    }

    const updatedRequest = await requestRepository.updateRequest(id, updateData);

    const io = getIO();
    io.emit('request_updated', updatedRequest);
    io.to(updatedRequest.patientId).emit('request_updated', updatedRequest);
    if (updatedRequest.driverId) {
      io.to(updatedRequest.driverId).emit('request_updated', updatedRequest);
    }

    return updatedRequest;
  }
}

export default new RequestService();
