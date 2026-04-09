import { Server } from 'socket.io';
import logger from '../utils/logger.js';

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    socket.on('join_room', (room) => {
      socket.join(room);
      logger.info(`Socket ${socket.id} joined room: ${room}`);
    });

    // Driver joins their active request room so location updates are targeted
    socket.on('join_request_room', (requestId) => {
      socket.join(`request:${requestId}`);
      logger.info(`Socket ${socket.id} joined request room: request:${requestId}`);
    });

    socket.on('request_created', (data) => {
      socket.broadcast.emit('new_emergency', data);
    });

    socket.on('driver_accept', (data) => {
      const payload = {
        patientId: data.patientId,
        requestId: data.requestId,
        driverId: data.driverId,
      };
      io.to(data.patientId).emit('driver_assigned', payload);
    });

    // Driver sends location — broadcast to request room AND globally for hospital dashboards
    socket.on('update_location', (data) => {
      logger.info(`📍 Location update from driver for request ${data.requestId}`);
      // Targeted: patient tracking page
      if (data.requestId) {
        io.to(`request:${data.requestId}`).emit('ambulance_location_update', data);
      }
      // Global: hospital dashboard fleet map
      io.emit('location_update', {
        ambulanceId: data.ambulanceId,
        driverId: data.driverId,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        requestId: data.requestId,
      });
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.IO initialized');
  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
};

export { initSocket, getIO };
