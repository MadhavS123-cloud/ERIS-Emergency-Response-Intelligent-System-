import http from 'http';
import env from './config/env.js';
import { connectDB } from './config/db.js';
import { initRedis } from './config/redis.js';
import { initQueue } from './services/queue.service.js';
import { initSocket } from './services/socket.service.js';
import app from './app.js';
import logger from './utils/logger.js';

const startServer = async () => {
  try {
    // 1. Connect to Database
    await connectDB();

    // 2. Initialize Redis
    const redisConnection = initRedis();

    // 3. Initialize Queue (depends on Redis)
    initQueue(redisConnection);

    // 4. Create HTTP server
    const server = http.createServer(app);

    // 5. Initialize Socket.IO (depends on HTTP server)
    initSocket(server);

    // 6. Start listening
    server.listen(env.PORT, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });

    // Graceful shutdown handlers
    process.on('unhandledRejection', (err) => {
      logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
      logger.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        logger.info('Process terminated.');
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
