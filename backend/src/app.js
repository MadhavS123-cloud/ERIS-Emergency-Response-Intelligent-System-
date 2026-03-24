const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { errorHandler } = require('./middlewares/error.middleware');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/user/user.routes');
const ambulanceRoutes = require('./modules/ambulance/ambulance.routes');
const hospitalRoutes = require('./modules/hospital/hospital.routes');
const requestRoutes = require('./modules/request/request.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const trackingRoutes = require('./modules/tracking/tracking.routes');

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

module.exports = app;
