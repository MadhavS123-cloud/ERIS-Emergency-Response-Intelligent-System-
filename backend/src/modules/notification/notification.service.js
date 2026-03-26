import logger from '../../utils/logger.js';

class NotificationService {
  /**
   * Mock sending email or SMS notification
   */
  async sendNotification(options) {
    // This is a placeholder for real notification logic (e.g., SendGrid, Twilio)
    logger.info(`Sending notification to: ${options.to}`);
    logger.info(`Subject: ${options.subject}`);
    logger.info(`Message: ${options.message}`);
    return true;
  }
}

export default new NotificationService();
