import { prisma } from '../../config/db.js';

const ambulanceInclude = {
  driver: {
    select: { id: true, name: true, phone: true, email: true }
  },
  hospital: {
    select: { id: true, name: true, address: true, locationLat: true, locationLng: true }
  }
};

class AmbulanceRepository {
  async createAmbulance(data) {
    return await prisma.ambulance.create({ data });
  }

  async findAllAmbulances() {
    return await prisma.ambulance.findMany({
      include: ambulanceInclude
    });
  }

  async findAmbulanceById(id) {
    return await prisma.ambulance.findUnique({
      where: { id },
      include: ambulanceInclude
    });
  }

  async findAvailableAmbulances() {
    return await prisma.ambulance.findMany({
      where: { isAvailable: true, driverId: { not: null } },
      include: ambulanceInclude
    });
  }

  async findAvailableAmbulancesByHospitalId(hospitalId) {
    return await prisma.ambulance.findMany({
      where: {
        hospitalId,
        isAvailable: true,
        driverId: { not: null }
      },
      include: ambulanceInclude
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
