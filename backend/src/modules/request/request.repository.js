import { prisma } from '../../config/db.js';

const requestInclude = {
  patient: { select: { id: true, name: true, phone: true, email: true } },
  driver: { select: { id: true, name: true, phone: true, email: true } },
  ambulance: {
    include: {
      driver: { select: { id: true, name: true, phone: true, email: true } },
      hospital: { select: { id: true, name: true, address: true, locationLat: true, locationLng: true } }
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
          { status: 'PENDING' },
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
}

export default new RequestRepository();
