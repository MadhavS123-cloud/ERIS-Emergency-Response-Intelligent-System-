import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler } from './middlewares/error.middleware.js';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/user/user.routes.js';
import ambulanceRoutes from './modules/ambulance/ambulance.routes.js';
import hospitalRoutes from './modules/hospital/hospital.routes.js';
import requestRoutes from './modules/request/request.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import trackingRoutes from './modules/tracking/tracking.routes.js';

const app = express();

// Global Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/ambulances', ambulanceRoutes);
app.use('/api/v1/hospitals', hospitalRoutes);
app.use('/api/v1/requests', requestRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/tracking', trackingRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'ERIS API is running' });
});

// Unknown Routes Handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
