import hospitalRepository from './hospital.repository.js';

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

  async updateHospital(id, data, actor) {
    await this.getHospitalById(id);

    if (actor?.role === 'HOSPITAL' && actor.hospitalId !== id) {
      throw Object.assign(new Error('You can only update your own hospital profile'), { statusCode: 403 });
    }

    return await hospitalRepository.updateHospital(id, data);
  }

  async deleteHospital(id) {
    await this.getHospitalById(id);
    await hospitalRepository.deleteHospital(id);
    return null;
  }
}

export default new HospitalService();
