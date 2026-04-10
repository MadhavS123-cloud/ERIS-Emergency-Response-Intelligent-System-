import resourcesService from './resources.service.js';
import APIResponse from '../../utils/response.js';

class ResourcesController {
  async getRecommendations(req, res, next) {
    try {
      const recommendations = await resourcesService.getResourceRecommendations(req.user);
      return APIResponse.success(res, recommendations, 'Resource recommendations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new ResourcesController();
