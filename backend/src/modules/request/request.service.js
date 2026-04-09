import requestRepository from './request.repository.js';
import ambulanceRepository from '../ambulance/ambulance.repository.js';
import hospitalRepository from '../hospital/hospital.repository.js';
import { addEmergencyRequestToQueue } from '../../services/queue.service.js';
import { getIO } from '../../services/socket.service.js';
import { calculateDistance } from '../../utils/distance.js';
import { prisma } from '../../config/db.js';
import { randomUUID } from 'crypto';

class RequestService {
  sortAmbulancesByDistance(ambulances, request) {
    return [...ambulances].sort((a, b) => (
      calculateDistance(request.locationLat, request.locationLng, a.locationLat ?? 0, a.locationLng ?? 0) -
      calculateDistance(request.locationLat, request.locationLng, b.locationLat ?? 0, b.locationLng ?? 0)
    ));
  }

  // ── Location Intelligence ──────────────────────────────────────────────────
  async checkLocationIntelligence(deviceId, lat, lng) {
    const flags = [];

    if (!deviceId || !lat || !lng) return { isSuspicious: false, reason: null };

    // 1. Repeated exact coordinates from same device in last 30 min
    const recentFromDevice = await prisma.request.findMany({
      where: {
        deviceId,
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        status: { not: 'CANCELLED' }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { locationLat: true, locationLng: true, createdAt: true }
    });

    for (const prev of recentFromDevice) {
      const dist = calculateDistance(lat, lng, prev.locationLat, prev.locationLng);
      if (dist < 0.05) { // within 50 metres
        flags.push('Repeated requests from same coordinates');
        break;
      }
    }

    // 2. Velocity check — impossible travel speed between requests
    if (recentFromDevice.length > 0) {
      const last = recentFromDevice[0];
      const distKm = calculateDistance(lat, lng, last.locationLat, last.locationLng);
      const timeDiffHours = (Date.now() - new Date(last.createdAt).getTime()) / 3600000;
      if (timeDiffHours > 0 && distKm / timeDiffHours > 300) {
        flags.push('Unrealistic location jump (>300 km/h between requests)');
      }
    }

    // 3. Cluster spam — 3+ requests from within 100m radius in last hour (any device)
    const nearbyCount = await prisma.request.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        locationLat: { gte: lat - 0.001, lte: lat + 0.001 },
        locationLng: { gte: lng - 0.001, lte: lng + 0.001 },
        isFake: false
      }
    });
    if (nearbyCount >= 3) {
      flags.push(`Cluster spam: ${nearbyCount} requests from same area in 1 hour`);
    }

    return {
      isSuspicious: flags.length > 0,
      reason: flags.join('; ') || null
    };
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
    let isSuspicious = data.isSuspicious || false;
    let suspiciousReason = data.suspiciousReason || null;

    if (data.deviceId) {
      const deviceTrust = await requestRepository.getDeviceTrust(data.deviceId);
      if (deviceTrust) {
        trustScore = deviceTrust.trustScore;

        // ── Blacklist enforcement ──────────────────────────────────────────
        if (deviceTrust.isBlacklisted) {
          // Still dispatch (act first) but mark highly suspicious
          isSuspicious = true;
          suspiciousReason = (suspiciousReason ? suspiciousReason + '; ' : '') + 'Device is blacklisted';
        }
      }
    }

    // ── Trust score threshold ──────────────────────────────────────────────
    if (trustScore <= -4) {
      isSuspicious = true;
      suspiciousReason = (suspiciousReason ? suspiciousReason + '; ' : '') + 'Extremely low trust score';
    }

    // ── Location intelligence ──────────────────────────────────────────────
    if (data.locationLat && data.locationLng) {
      const locCheck = await this.checkLocationIntelligence(
        data.deviceId, data.locationLat, data.locationLng
      );
      if (locCheck.isSuspicious) {
        isSuspicious = true;
        suspiciousReason = (suspiciousReason ? suspiciousReason + '; ' : '') + locCheck.reason;
      }
    }

    const request = await requestRepository.createRequest({
      isGuest: true,
      guestSessionId: randomUUID(),
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
      isSuspicious,
      suspiciousReason,
      trustScoreAtRequest: trustScore
    });

    // Act first, verify later — always dispatch
    await addEmergencyRequestToQueue(request);

    // Background reverse geocoding
    if (data.locationLat && data.locationLng && request.pickupAddress === 'Unknown GPS Location') {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.locationLat}&lon=${data.locationLng}`)
        .then(r => r.json())
        .then(async geo => {
          if (geo?.display_name) {
            await requestRepository.updateRequest(request.id, { pickupAddress: geo.display_name });
          }
        }).catch(() => {});
    }

    // Inline fast dispatch — even for suspicious (act first)
    try {
      const assignedAmbulance = await this.assignAmbulance(request, { role: 'ADMIN' });
      await requestRepository.updateRequest(request.id, {
        status: 'ACCEPTED',
        ambulanceId: assignedAmbulance.id,
        driverId: assignedAmbulance.driverId
      });
    } catch (e) {
      // No ambulance available — keep PENDING, hospital will assign manually
      console.warn('Auto-assign failed (no ambulance available):', e.message);
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
       newStatus = 'CANCELLED';
       if (request.deviceId) {
          await requestRepository.updateDeviceTrustScore(request.deviceId, -2, true);
       }
    } else if (driverFeedback === 'Patient Found') {
       updateData.driverFeedback = driverFeedback;
       // Positive signal — boost trust score
       if (request.deviceId) {
          await requestRepository.updateDeviceTrustScore(request.deviceId, 1, false);
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
    // Broadcast to all relevant parties
    io.emit('request_updated', updatedRequest);
    // Targeted: patient
    if (updatedRequest.patientId) {
      io.to(updatedRequest.patientId).emit('request_updated', updatedRequest);
    }
    // Targeted: driver
    if (updatedRequest.driverId) {
      io.to(updatedRequest.driverId).emit('request_updated', updatedRequest);
    }
    // Targeted: hospital dashboard
    const hospitalId = updatedRequest.ambulance?.hospital?.id;
    if (hospitalId) {
      io.to(hospitalId).emit('request_updated', updatedRequest);
    }
    // Targeted: patient tracking page (request room)
    io.to(`request:${updatedRequest.id}`).emit('request_updated', updatedRequest);

    return updatedRequest;
  }
}

export default new RequestService();
