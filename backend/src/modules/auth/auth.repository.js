import { prisma } from '../../config/db.js';

class AuthRepository {
  async createUser(userData) {
    return await prisma.user.create({
      data: userData
    });
  }

  async findUserByEmail(email) {
    return await prisma.user.findUnique({
      where: { email }
    });
  }

  async findUserById(id) {
    return await prisma.user.findUnique({
      where: { id }
    });
  }

  async updateUser(id, userData) {
    return await prisma.user.update({
      where: { id },
      data: userData
    });
  }
}

export default new AuthRepository();
