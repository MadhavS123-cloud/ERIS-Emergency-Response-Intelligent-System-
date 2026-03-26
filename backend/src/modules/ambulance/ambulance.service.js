import ambulanceRepository from './ambulance.repository.js';

class AmbulanceService {
  async createAmbulance(data) {
    // Optionally check if driver exists and role is DRIVER
    return await ambulanceRepository.createAmbulance(data);
  }

  async getAllAmbulances() {
    return await ambulanceRepository.findAllAmbulances();
  }

  async getAmbulanceById(id) {
    const ambulance = await ambulanceRepository.findAmbulanceById(id);
    if (!ambulance) {
      throw Object.assign(new Error('Ambulance not found'), { statusCode: 404 });
    }
    return ambulance;
  }

  async updateAmbulance(id, data) {
    await this.getAmbulanceById(id);
    return await ambulanceRepository.updateAmbulance(id, data);
  }

  async deleteAmbulance(id) {
    await this.getAmbulanceById(id);
    await ambulanceRepository.deleteAmbulance(id);
    return null;
  }
}

export default new AmbulanceService();
