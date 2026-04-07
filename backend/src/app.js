import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { errorHandler } from './middlewares/error.middleware.js';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/user/user.routes.js';
import ambulanceRoutes from './modules/ambulance/ambulance.routes.js';
import hospitalRoutes from './modules/hospital/hospital.routes.js';
import requestRoutes from './modules/request/request.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import trackingRoutes from './modules/tracking/tracking.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

const app = express();

// Security headers — CSP tuned to allow Leaflet CDN and map tiles
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      scriptSrcElem:  ["'self'", "https://unpkg.com"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
      styleSrcElem:   ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com"],
      imgSrc:         ["'self'", "data:", "blob:", "https://*.cartocdn.com", "https://*.openstreetmap.org", "https://unpkg.com"],
      connectSrc:     ["'self'", "wss:", "ws:", "https:"],
      workerSrc:      ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // needed for map tiles / third-party resources
}));

// CORS — allow Vercel frontend and any origin configured via env
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and listed origins
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
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

// Static frontend — ONLY serve locally (dev). In production, frontend is on Vercel.
if (process.env.NODE_ENV !== 'production' && fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get(/^\/(?!api|health).*/, (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.status(200).json({ status: 'success', message: 'ERIS API Backend is running.' });
  });
}

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
