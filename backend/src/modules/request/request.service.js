import requestRepository from './request.repository.js';
import ambulanceRepository from '../ambulance/ambulance.repository.js';
import hospitalRepository from '../hospital/hospital.repository.js';
import { addEmergencyRequestToQueue } from '../../services/queue.service.js';
import { getIO } from '../../services/socket.service.js';
import { calculateDistance } from '../../utils/distance.js';
import { prisma } from '../../config/db.js';
import { randomUUID } from 'crypto';
import MLService from '../../services/ml.service.js';
import logger from '../../utils/logger.js';

class RequestService {
  sortAmbulancesByDistance(ambulances, request) {
    return [...ambulances].sort((a, b) => (
      calculateDistance(request.locationLat, request.locationLng, a.locationLat ?? 0, a.locationLng ?? 0) -
      calculateDistance(request.locationLat, request.locationLng, b.locationLat ?? 0, b.locationLng ?? 0)
    ));
  }

  /**
   * Get ML predictions for a request (delay, severity, hospital recommendations).
   * @param {Object} requestData - Request data including location, emergency type, etc.
   * @returns {Promise<Object>} - ML predictions or null if service unavailable
   */
  async getMLPredictions(requestData) {
    try {
      const startTime = Date.now();

      // Compute features first
      const features = await MLService.computeFeatures({
        request_id: requestData.id || 'temp',
        location_lat: requestData.locationLat,
        location_lng: requestData.locationLng,
        emergency_type: requestData.emergencyType,
        timestamp: new Date().toISOString()
      });

      if (!features || !features.features) {
        logger.warn('Failed to compute features for ML predictions');
        return null;
      }

      // Get delay prediction
      const delayPrediction = await MLService.predictDelay({
        distance_km: features.features.distance_to_nearest_hospital_km || 5.0,
        time_of_day: features.features.hour_of_day || new Date().getHours(),
        day_of_week: features.features.day_of_week || new Date().getDay(),
        traffic_level: features.features.traffic_level || 'Medium',
        weather: features.features.weather || 'Clear',
        area_type: features.features.area_type || 'urban',
        available_ambulances_nearby: features.features.available_ambulances_nearby || 3
      });

      // Get severity prediction
      const severityPrediction = await MLService.predictSeverity({
        emergency_type: requestData.emergencyType,
        patient_age: requestData.patientAge || null,
        vital_signs: requestData.vitalSigns || null,
        location_type: 'home'
      });

      // Get hospital recommendations
      const hospitalRecommendation = await MLService.recommendHospital({
        patient_location: {
          lat: requestData.locationLat,
          lng: requestData.locationLng
        },
        emergency_type: requestData.emergencyType,
        severity: severityPrediction?.severity || 'Medium',
        current_time: new Date().toISOString()
      });

      const latency = Date.now() - startTime;

      return {
        delay: delayPrediction,
        severity: severityPrediction,
        hospital: hospitalRecommendation,
        features: features.features,
        latency_ms: latency
      };
    } catch (error) {
      logger.error('Error getting ML predictions', { message: error.message });
      return null;
    }
  }

  /**
   * Store ML predictions in database.
   * @param {string} requestId - Request ID
   * @param {Object} predictions - ML predictions object
   */
  async storeMlPredictions(requestId, predictions) {
    if (!predictions) return;

    try {
      // Store delay prediction
      if (predictions.delay) {
        await MLService.storePrediction({
          request_id: requestId,
          model_name: 'delay_predictor',
          model_version: predictions.delay.model_version || 'v2.0',
          prediction_type: 'delay',
          prediction_value: {
            delay_minutes: predictions.delay.delay_minutes,
            risk_category: predictions.delay.risk_category,
            confidence: predictions.delay.confidence,
            prediction_interval: predictions.delay.prediction_interval
          },
          features_used: predictions.features || {},
          explanation: predictions.delay.explanation || null,
          confidence_score: predictions.delay.confidence,
          latency_ms: predictions.latency_ms
        });
      }

      // Store severity prediction
      if (predictions.severity) {
        await MLService.storePrediction({
          request_id: requestId,
          model_name: 'severity_classifier',
          model_version: predictions.severity.model_version || 'v1.0',
          prediction_type: 'severity',
          prediction_value: {
            severity: predictions.severity.severity,
            confidence: predictions.severity.confidence,
            recommended_actions: predictions.severity.recommended_actions
          },
          features_used: predictions.features || {},
          explanation: null,
          confidence_score: predictions.severity.confidence,
          latency_ms: predictions.latency_ms
        });
      }

      // Store hospital recommendation
      if (predictions.hospital && predictions.hospital.recommendations) {
        await MLService.storePrediction({
          request_id: requestId,
          model_name: 'hospital_recommender',
          model_version: 'v1.0',
          prediction_type: 'hospital_recommendation',
          prediction_value: {
            recommendations: predictions.hospital.recommendations
          },
          features_used: predictions.features || {},
          explanation: null,
          confidence_score: null,
          latency_ms: predictions.latency_ms
        });
      }
    } catch (error) {
      logger.error('Error storing ML predictions', { message: error.message });
      // Don't throw - prediction storage failure shouldn't block request creation
    }
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
    // Ensure empty phone numbers are stored as null, not empty string or "Not Provided"
    const patientPhone = data.patientPhone && data.patientPhone.trim() !== '' 
      ? data.patientPhone 
      : null;
    
    // Get ML predictions before creating request
    const tempRequest = {
      id: 'temp',
      locationLat: data.locationLat,
      locationLng: data.locationLng,
      emergencyType: data.emergencyType,
      patientAge: data.patientAge || null,
      vitalSigns: data.vitalSigns || null
    };
    
    const predictions = await this.getMLPredictions(tempRequest);
    
    // Extract ML hospital recommendation if available
    let mlRecommendedHospitalId = predictions?.hospital?.recommendations?.[0]?.hospital_id || null;
    let mlRecommendedHospitalName = predictions?.hospital?.recommendations?.[0]?.hospital_name || null;
    
    const hospitals = await hospitalRepository.findAllHospitals();

    if (mlRecommendedHospitalId) {
      const mlHospital = hospitals.find(h => h.id === mlRecommendedHospitalId);
      if (mlHospital && (!mlHospital.ambulances || !mlHospital.ambulances.some(a => a.status === 'AVAILABLE'))) {
         logger.info(`ML recommended hospital ${mlRecommendedHospitalName} has no available drivers. Re-routing...`);
         mlRecommendedHospitalId = null;
      }
    }

    // Auto-assign nearest hospital
    if (!mlRecommendedHospitalId) {
      let eligibleHospitals = hospitals.filter(h => 
        typeof h.locationLat === 'number' && typeof h.locationLng === 'number' && h.ambulances && h.ambulances.some(a => a.status === 'AVAILABLE')
      );
      if (eligibleHospitals.length === 0) {
        eligibleHospitals = hospitals.filter(h => typeof h.locationLat === 'number' && typeof h.locationLng === 'number');
      }
      const nearestHospital = eligibleHospitals
        .sort((a, b) => (
          calculateDistance(data.locationLat, data.locationLng, a.locationLat, a.locationLng) -
          calculateDistance(data.locationLat, data.locationLng, b.locationLat, b.locationLng)
        ))[0];
        
      if (nearestHospital) {
        mlRecommendedHospitalId = nearestHospital.id;
        mlRecommendedHospitalName = nearestHospital.name;
        logger.info(`Auto-assigned nearest hospital: ${nearestHospital.name}`);
      }
    }
    
    const request = await requestRepository.createRequest({
      patientId,
      locationLat: data.locationLat,
      locationLng: data.locationLng,
      emergencyType: data.emergencyType,
      pickupAddress: data.pickupAddress,
      patientName: data.patientName,
      patientPhone: patientPhone,
      medicalNotes: data.medicalNotes || '',
      status: 'PENDING',
      ...(mlRecommendedHospitalId && { mlRecommendedHospitalId }),
      ...(mlRecommendedHospitalName && { mlRecommendedHospitalName })
    });

    // Store ML predictions
    if (predictions) {
      await this.storeMlPredictions(request.id, predictions);
      logger.info('ML predictions stored for request', { 
        requestId: request.id, 
        delay: predictions.delay?.delay_minutes,
        severity: predictions.severity?.severity,
        recommendedHospital: mlRecommendedHospitalName
      });
    }

    await addEmergencyRequestToQueue(request);

    const io = getIO();
    io.emit('new_emergency', request);
    io.emit('request_updated', request);

    return request;
  }

  async createGuestEmergency(data) {
    if (data.emergencyType === 'Panic SOS' && data.deviceId) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentPanic = await prisma.request.findFirst({
        where: {
          deviceId: data.deviceId,
          emergencyType: 'Panic SOS',
          createdAt: { gte: twentyFourHoursAgo }
        }
      });
      
      if (recentPanic) {
        throw Object.assign(new Error('1-Tap Emergency is limited to once per day per device to prevent misuse. Please use "Book with details" for further requests.'), { statusCode: 429 });
      }
    }

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

    // Get ML predictions before creating request
    const tempRequest = {
      id: 'temp',
      locationLat: data.locationLat,
      locationLng: data.locationLng,
      emergencyType: data.emergencyType || 'General Emergency',
      patientAge: null,
      vitalSigns: null
    };
    
    const predictions = await this.getMLPredictions(tempRequest);
    
    // Extract ML hospital recommendation if available
    let mlRecommendedHospitalId = predictions?.hospital?.recommendations?.[0]?.hospital_id || null;
    let mlRecommendedHospitalName = predictions?.hospital?.recommendations?.[0]?.hospital_name || null;

    const hospitals = await hospitalRepository.findAllHospitals();

    if (mlRecommendedHospitalId) {
      const mlHospital = hospitals.find(h => h.id === mlRecommendedHospitalId);
      if (mlHospital && (!mlHospital.ambulances || !mlHospital.ambulances.some(a => a.status === 'AVAILABLE'))) {
         logger.info(`ML recommended hospital ${mlRecommendedHospitalName} has no available drivers. Re-routing...`);
         mlRecommendedHospitalId = null;
      }
    }

    // Auto-assign nearest hospital
    if (!mlRecommendedHospitalId) {
      let eligibleHospitals = hospitals.filter(h => 
        typeof h.locationLat === 'number' && typeof h.locationLng === 'number' && h.ambulances && h.ambulances.some(a => a.status === 'AVAILABLE')
      );
      if (eligibleHospitals.length === 0) {
        eligibleHospitals = hospitals.filter(h => typeof h.locationLat === 'number' && typeof h.locationLng === 'number');
      }
      const nearestHospital = eligibleHospitals
        .sort((a, b) => (
          calculateDistance(data.locationLat, data.locationLng, a.locationLat, a.locationLng) -
          calculateDistance(data.locationLat, data.locationLng, b.locationLat, b.locationLng)
        ))[0];
        
      if (nearestHospital) {
        mlRecommendedHospitalId = nearestHospital.id;
        mlRecommendedHospitalName = nearestHospital.name;
        logger.info(`Auto-assigned nearest hospital for guest: ${nearestHospital.name}`);
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
      trustScoreAtRequest: trustScore,
      ...(mlRecommendedHospitalId && { mlRecommendedHospitalId }),
      ...(mlRecommendedHospitalName && { mlRecommendedHospitalName })
    });

    // Store ML predictions
    if (predictions) {
      await this.storeMlPredictions(request.id, predictions);
      logger.info('ML predictions stored for guest request', { 
        requestId: request.id, 
        delay: predictions.delay?.delay_minutes,
        severity: predictions.severity?.severity,
        recommendedHospital: mlRecommendedHospitalName
      });
    }

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
      
      // Initialize ambulance location from hospital's GPS coordinates
      const hospital = assignedAmbulance.hospital;
      if (hospital?.locationLat && hospital?.locationLng) {
        await ambulanceRepository.updateAmbulance(assignedAmbulance.id, {
          locationLat: hospital.locationLat,
          locationLng: hospital.locationLng
        });
        logger.info(`Ambulance ${assignedAmbulance.id} location initialized from hospital ${hospital.name} for guest emergency`);
      }
      
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

      // Always initialize ambulance location from hospital's GPS coordinates when assigned
      const hospital = assignedAmbulance.hospital;
      if (hospital?.locationLat && hospital?.locationLng) {
        await ambulanceRepository.updateAmbulance(assignedAmbulance.id, {
          locationLat: hospital.locationLat,
          locationLng: hospital.locationLng
        });
        logger.info(`Ambulance ${assignedAmbulance.id} location initialized from hospital ${hospital.name} at (${hospital.locationLat}, ${hospital.locationLng})`);
      } else {
        logger.warn(`Hospital ${assignedAmbulance.hospitalId} has no valid GPS coordinates for ambulance initialization`);
      }
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
