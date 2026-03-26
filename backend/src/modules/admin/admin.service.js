import userRepository from '../user/user.repository.js';
import requestRepository from '../request/request.repository.js';

class AdminService {
  async getDashboardStats() {
    const users = await userRepository.findAllUsers();
    const requests = await requestRepository.findAllRequests();
    // In a real app, query specifically for counts
    return {
      totalUsers: users.length,
      activeAmbulances: 12, // Placeholder
      pendingRequests: requests.filter(r => r.status === 'PENDING').length,
      totalHospitals: 8 // Placeholder
    };
  }

  async getAllUsers() {
    return await userRepository.findAllUsers();
  }

  async getAllRequests() {
    return await requestRepository.findAllRequests();
  }
}

export default new AdminService();
