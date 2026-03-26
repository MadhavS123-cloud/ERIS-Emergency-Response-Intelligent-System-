import userService from './user.service.js';
import APIResponse from '../../utils/response.js';

class UserController {
  async getAllUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();
      return APIResponse.success(res, users, 'Users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getUser(req, res, next) {
    try {
      const user = await userService.getUserById(req.params.id);
      return APIResponse.success(res, user, 'User retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      const user = await userService.getUserById(req.user.id);
      return APIResponse.success(res, user, 'Current user retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      // Prevent updating role via this endpoint
      delete req.body.role;
      delete req.body.email;
      const user = await userService.updateUser(req.params.id, req.body);
      return APIResponse.success(res, user, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req, res, next) {
    try {
      await userService.deleteUser(req.params.id);
      return res.status(204).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
