import { prisma } from '../../config/db.js';

class HospitalRepository {
  async createHospital(data) {
    return await prisma.hospital.create({ data });
  }

  async findAllHospitals() {
    return await prisma.hospital.findMany({
      include: {
        admin: {
          select: { id: true, name: true, phone: true }
        }
      }
    });
  }

  async findHospitalById(id) {
    return await prisma.hospital.findUnique({
      where: { id },
      include: {
        admin: {
          select: { id: true, name: true, phone: true }
        }
      }
    });
  }

  async updateHospital(id, data) {
    return await prisma.hospital.update({
      where: { id },
      data
    });
  }

  async deleteHospital(id) {
    return await prisma.hospital.delete({
      where: { id }
    });
  }
}

export default new HospitalRepository();
