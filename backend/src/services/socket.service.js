import { Server } from 'socket.io';
import logger from '../utils/logger.js';

let io;

/**
 * Initialize Socket.IO. Call once during server startup.
 * @param {import('http').Server} server - The HTTP server instance
 * @returns {Server} The Socket.IO server instance
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Define specific origins in production
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    // Placeholder events
    socket.on('join_room', (room) => {
      socket.join(room);
      logger.info(`User ${socket.id} joined room ${room}`);
    });

    socket.on('request_created', (data) => {
      logger.info('Emergency request created', data);
      socket.broadcast.emit('new_emergency', data);
    });

    socket.on('driver_accept', (data) => {
      logger.info('Driver accepted request', data);
      io.to(data.patientId).emit('driver_assigned', data);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.IO initialized');
  return io;
};

/**
 * Get the active Socket.IO instance.
 * @returns {Server} The Socket.IO server instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

export { initSocket, getIO };
