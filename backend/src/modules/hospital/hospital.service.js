const hospitalRepository = require('./hospital.repository');

class HospitalService {
  async createHospital(data) {
    return await hospitalRepository.createHospital(data);
  }

  async getAllHospitals() {
    return await hospitalRepository.findAllHospitals();
  }

  async getHospitalById(id) {
    const hospital = await hospitalRepository.findHospitalById(id);
    if (!hospital) {
      throw Object.assign(new Error('Hospital not found'), { statusCode: 404 });
    }
    return hospital;
  }

  async updateHospital(id, data) {
    await this.getHospitalById(id);
    return await hospitalRepository.updateHospital(id, data);
  }

  async deleteHospital(id) {
    await this.getHospitalById(id);
    await hospitalRepository.deleteHospital(id);
    return null;
  }
}

module.exports = new HospitalService();
