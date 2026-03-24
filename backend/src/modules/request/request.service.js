const requestRepository = require('./request.repository');
const { addEmergencyRequestToQueue } = require('../../services/queue.service');
const { getIO } = require('../../services/socket.service');

class RequestService {
  async createRequest(patientId, data) {
    // Save to DB
    const request = await requestRepository.createRequest({
      patientId,
      locationLat: data.locationLat,
      locationLng: data.locationLng,
      status: 'PENDING'
    });

    // Add to processing queue
    await addEmergencyRequestToQueue(request);

    // Broadcast event to available ambulances
    const io = getIO();
    io.emit('new_emergency', request);

    return request;
  }

  async getRequestById(id) {
    const request = await requestRepository.findRequestById(id);
    if (!request) {
      throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    }
    return request;
  }

  async getAllRequests() {
    return await requestRepository.findAllRequests();
  }

  async getUserRequests(patientId) {
    return await requestRepository.findRequestsByPatientId(patientId);
  }

  async updateRequestStatus(id, status, driverId = null) {
    const request = await this.getRequestById(id);

    const updateData = { status };
    if (driverId) {
      updateData.driverId = driverId;
    }

    const updatedRequest = await requestRepository.updateRequest(id, updateData);

    // Notify patient
    const io = getIO();
    io.to(updatedRequest.patientId).emit('request_updated', updatedRequest);

    return updatedRequest;
  }
}

module.exports = new RequestService();
