import { prisma } from '../../config/db.js';

class AmbulanceRepository {
  async createAmbulance(data) {
    return await prisma.ambulance.create({ data });
  }

  async findAllAmbulances() {
    return await prisma.ambulance.findMany({
      include: {
        driver: {
          select: { id: true, name: true, phone: true }
        }
      }
    });
  }

  async findAmbulanceById(id) {
    return await prisma.ambulance.findUnique({
      where: { id },
      include: {
        driver: {
          select: { id: true, name: true, phone: true }
        }
      }
    });
  }

  async updateAmbulance(id, data) {
    return await prisma.ambulance.update({
      where: { id },
      data
    });
  }

  async deleteAmbulance(id) {
    return await prisma.ambulance.delete({
      where: { id }
    });
  }
}

export default new AmbulanceRepository();
