const { prisma } = require('../../config/db');

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

module.exports = new AuthRepository();
