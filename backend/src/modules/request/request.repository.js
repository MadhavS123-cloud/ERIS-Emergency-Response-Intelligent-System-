import { prisma } from '../../config/db.js';

class RequestRepository {
  async createRequest(data) {
    return await prisma.request.create({ data });
  }

  async findAllRequests() {
    return await prisma.request.findMany({
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true } }
      }
    });
  }

  async findRequestById(id) {
    return await prisma.request.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true } }
      }
    });
  }

  async updateRequest(id, data) {
    return await prisma.request.update({
      where: { id },
      data
    });
  }

  async findRequestsByPatientId(patientId) {
    return await prisma.request.findMany({
      where: { patientId },
      include: {
        driver: { select: { id: true, name: true, phone: true } }
      }
    });
  }
}

export default new RequestRepository();
