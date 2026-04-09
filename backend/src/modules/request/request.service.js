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

  async createGuestEmergency(data) {
    let trustScore = 0;
    if (data.deviceId) {
       const deviceTrust = await requestRepository.getDeviceTrust(data.deviceId);
       if (deviceTrust) trustScore = deviceTrust.trustScore;
    }

    let isSuspicious = data.isSuspicious;
    let suspiciousReason = data.suspiciousReason;

    // Reject extremely low trust strictly or flag them
    if (trustScore <= -4) {
       isSuspicious = true;
       suspiciousReason = (suspiciousReason ? suspiciousReason + '; ' : '') + 'Extremely low trust score (Bot likely)';
    }

    const request = await requestRepository.createRequest({
      isGuest: true,
      locationLat: data.locationLat,
      locationLng: data.locationLng,
      emergencyType: data.emergencyType || 'General Emergency',
      pickupAddress: data.pickupAddress || 'Unknown GPS Location',
      patientName: 'Guest User',
      patientPhone: null,
      medicalNotes: '',
      status: 'PENDING',
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      deviceId: data.deviceId,
      isSuspicious: isSuspicious,
      suspiciousReason: suspiciousReason,
      trustScoreAtRequest: trustScore
    });

    // Act first, verify later: Auto dispatch via queue
    await addEmergencyRequestToQueue(request);
    
    // Background Reverse Geocoding
    if (data.locationLat && data.locationLng && request.pickupAddress === 'Unknown GPS Location') {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.locationLat}&lon=${data.locationLng}`)
        .then(r => r.json())
        .then(async geo => {
          if (geo && geo.display_name) {
             await requestRepository.updateRequest(request.id, { pickupAddress: geo.display_name });
          }
        }).catch(err => {
          // ignore background geocode errors
        });
    }
    
    // Direct assignment logic for lightning-fast dispatch inline if needed, but queue does it cleanly!
    try {
      if (!isSuspicious) {
        // Just trigger standard queue/admin accept directly
         const assignedAmbulance = await this.assignAmbulance(request, { role: 'ADMIN' });
         await requestRepository.updateRequest(request.id, { 
            status: 'ACCEPTED', 
            ambulanceId: assignedAmbulance.id, 
            driverId: assignedAmbulance.driverId 
         });
      }
    } catch (e) {
      console.error('Instant assign failed, queue might pick it up', e.message);
    }

    const finalRequest = await requestRepository.findRequestById(request.id);
    const io = getIO();
    io.emit('new_emergency', finalRequest);
    io.emit('request_updated', finalRequest);

    return finalRequest;
  }

  async linkPhoneToRequest(requestId, phone) {
    // Soft identity
    const request = await requestRepository.updateRequest(requestId, { patientPhone: phone });
    // Emit the update so dashboards see the new valid phone
    const io = getIO();
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
    let newStatus = status?.toUpperCase();
    const updateData = {};
    const { ambulanceId = null, driverFeedback = null } = options;

    if (driverFeedback === 'False Request') {
       updateData.isFake = true;
       updateData.driverFeedback = driverFeedback;
       newStatus = 'CANCELLED'; // Force cancel
       if (request.deviceId) {
          await requestRepository.updateDeviceTrustScore(request.deviceId, -2, true);
       }
    } else if (newStatus === 'COMPLETED' && request.deviceId) {
       await requestRepository.updateDeviceTrustScore(request.deviceId, 1, false);
    }
    
    updateData.status = newStatus;

    if (newStatus === 'ACCEPTED') {
      if (!['ADMIN', 'HOSPITAL'].includes(actorRole)) {
        throw Object.assign(new Error('Only hospital staff can assign ambulances'), { statusCode: 403 });
      }

      const assignedAmbulance = await this.assignAmbulance(request, actor, ambulanceId);
      updateData.ambulanceId = assignedAmbulance.id;
      updateData.driverId = assignedAmbulance.driverId;
    }

    if (actorRole === 'DRIVER') {
      if (!['EN_ROUTE', 'ARRIVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'].includes(newStatus)) {
        throw Object.assign(new Error('Drivers can only start navigation or complete/cancel handover'), { statusCode: 403 });
      }

      if (!request.driverId || request.driverId !== actor.id) {
        throw Object.assign(new Error('This request is not assigned to you'), { statusCode: 403 });
      }
    }

    if (actorRole === 'HOSPITAL' && requestHospitalId && actor.hospitalId !== requestHospitalId) {
      throw Object.assign(new Error('You can only manage requests assigned to your own hospital'), { statusCode: 403 });
    }

    if (['COMPLETED', 'CANCELLED'].includes(newStatus) && request.ambulanceId) {
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
