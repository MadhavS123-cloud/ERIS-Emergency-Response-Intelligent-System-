const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Define specific origins in production
      methods: ['GET', 'POST']
    }
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

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = { initSocket, getIO };
