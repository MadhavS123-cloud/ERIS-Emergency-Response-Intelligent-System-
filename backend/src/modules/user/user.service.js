const userRepository = require('./user.repository');

class UserService {
  async getAllUsers() {
    return await userRepository.findAllUsers();
  }

  async getUserById(id) {
    const user = await userRepository.findUserById(id);
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    return user;
  }

  async updateUser(id, updateData) {
    await this.getUserById(id); // Check existence
    return await userRepository.updateUser(id, updateData);
  }

  async deleteUser(id) {
    await this.getUserById(id); // Check existence
    await userRepository.deleteUser(id);
    return null;
  }
}

module.exports = new UserService();
