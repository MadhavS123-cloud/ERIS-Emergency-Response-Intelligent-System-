import { prisma } from '../../config/db.js';

const requestInclude = {
  patient: { select: { id: true, name: true, phone: true, email: true } },
  driver: { select: { id: true, name: true, phone: true, email: true } },
  ambulance: {
    include: {
      driver: { select: { id: true, name: true, phone: true, email: true } },
      hospital: { select: { id: true, name: true, address: true, locationLat: true, locationLng: true, staff: { select: { email: true } } } }
    }
  }
};

class RequestRepository {
  async createRequest(data) {
    return await prisma.request.create({
      data,
      include: requestInclude
    });
  }

  async findAllRequests() {
    return await prisma.request.findMany({
      include: requestInclude,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findRequestsForHospital(hospitalId) {
    return await prisma.request.findMany({
      where: {
        OR: [
          {
            status: 'PENDING',
            mlRecommendedHospitalId: hospitalId
          },
          {
            ambulance: {
              is: { hospitalId }
            }
          }
        ]
      },
      include: requestInclude,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findRequestById(id) {
    return await prisma.request.findUnique({
      where: { id },
      include: requestInclude
    });
  }

  async updateRequest(id, data) {
    return await prisma.request.update({
      where: { id },
      data,
      include: requestInclude
    });
  }

  async findRequestsByPatientId(patientId) {
    return await prisma.request.findMany({
      where: { patientId },
      include: requestInclude,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findRequestsByDriverId(driverId) {
    return await prisma.request.findMany({
      where: { driverId },
      include: requestInclude,
      orderBy: { createdAt: 'desc' }
    });
  }

  async getDeviceTrust(deviceId) {
    if (!deviceId) return null;
    return await prisma.deviceTrust.findUnique({ where: { deviceId } });
  }

  async updateDeviceTrustScore(deviceId, scoreChange, isFake = false) {
    if (!deviceId) return null;
    
    const incrementFields = { trustScore: scoreChange };
    if (isFake) {
       incrementFields.totalFake = 1;
    } else if (scoreChange > 0) {
       incrementFields.totalValid = 1;
    }

    let record = await prisma.deviceTrust.findUnique({ where: { deviceId }});
    if (!record) {
      return await prisma.deviceTrust.create({
         data: { 
            deviceId, 
            trustScore: scoreChange,
            totalFake: isFake ? 1 : 0,
            totalValid: (!isFake && scoreChange > 0) ? 1 : 0
         }
      });
    }
    
    return await prisma.deviceTrust.update({
      where: { deviceId },
      data: {
        trustScore: { increment: scoreChange },
        totalFake: isFake ? { increment: 1 } : undefined,
        totalValid: (!isFake && scoreChange > 0) ? { increment: 1 } : undefined
      }
    });
  }
}

export default new RequestRepository();
