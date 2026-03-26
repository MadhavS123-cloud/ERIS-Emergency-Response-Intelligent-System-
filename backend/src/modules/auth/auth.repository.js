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
}

export default new AuthRepository();
