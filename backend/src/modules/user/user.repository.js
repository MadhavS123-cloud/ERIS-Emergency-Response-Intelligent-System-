import { prisma } from '../../config/db.js';

class UserRepository {
  async findAllUsers() {
    return await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true
      }
    });
  }

  async findUserById(id) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true
      }
    });
  }

  async updateUser(id, data) {
    return await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true
      }
    });
  }

  async deleteUser(id) {
    return await prisma.user.delete({
      where: { id }
    });
  }
}

export default new UserRepository();
