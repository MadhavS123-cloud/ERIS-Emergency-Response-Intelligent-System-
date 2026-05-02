import http from "http";
import { fileURLToPath } from "url";
import env from "./config/env.js";
import { connectDB, startKeepAlive } from "./config/db.js";
import { initRedis } from "./config/redis.js";
import { initQueue } from "./services/queue.service.js";
import { initSocket } from "./services/socket.service.js";
import app from "./app.js";
import logger from "./utils/logger.js";

const registerProcessHandlers = (server) => {
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    logger.error(`${err.name}: ${err.message}`);
    logger.error(err.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(`${err.name}: ${err.message}`);
    logger.error(err.stack);
    server.close(() => {
      process.exit(1);
    });
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      logger.info("Process terminated.");
    });
  });
};

const startServer = async () => {
  try {
    await connectDB();
    logger.info("✅ Database connected");
    
    // Start keep-alive to prevent Neon database from sleeping during active sessions
    startKeepAlive();

    const redisConnection = initRedis();
    logger.info("✅ Redis initialized");

    initQueue(redisConnection);
    logger.info("✅ Queue initialized");

    const server = http.createServer(app);

    initSocket(server);
    logger.info("✅ Socket.IO initialized");

    registerProcessHandlers(server);

    server.listen(env.PORT, () => {
      logger.info(
        `🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`
      );
    });

    return server;
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  startServer();
}

export { startServer };
