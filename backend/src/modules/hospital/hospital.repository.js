import { prisma } from '../../config/db.js';

class HospitalRepository {
  async createHospital(data) {
    return await prisma.hospital.create({ data });
  }

  async findAllHospitals() {
    return await prisma.hospital.findMany({
      include: {
        ambulances: {
          include: {
            driver: {
              select: { id: true, name: true, phone: true, email: true }
            }
          }
        }
      }
    });
  }

  async findHospitalById(id) {
    return await prisma.hospital.findUnique({
      where: { id },
      include: {
        ambulances: {
          include: {
            driver: {
              select: { id: true, name: true, phone: true, email: true }
            }
          }
        },
        staff: {
          select: { id: true, name: true, email: true, role: true }
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
