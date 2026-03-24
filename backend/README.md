# ERIS Emergency Response Intelligent System - Backend Boilerplate

This is a production-ready baseline for the ERIS platform backend.

## Tech Stack
- **Node.js & Express.js**
- **PostgreSQL & Prisma ORM**
- **Socket.IO** (Real-time updates)
- **BullMQ + Redis** (Job queue for emergency processing)
- **JWT** (Authentication)

## Project Structure
```
backend/
├── prisma/
│   └── schema.prisma       # Database schema setup
├── src/
│   ├── config/             # DB & env Config files
│   ├── middlewares/        # Express middlewares (Auth, Error, Validation)
│   ├── modules/            # Business domains (Auth, User, Ambulance, etc.)
│   ├── services/           # External and generic services (Queue, Socket, ML)
│   ├── utils/              # Resuable helpers
│   ├── app.js              # Express app setup
│   └── server.js           # Main entry point
├── .env                    # Environment variables
└── package.json            # Node project configuration
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL installed and running
- Redis running on `127.0.0.1:6379` (For BullMQ)

### Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Database Setup**
   Update your database credentials in the `.env` file, then run:
   ```bash
   npx prisma db push
   # OR
   npx prisma migrate dev --name init
   ```
   *Optional:* Seed the database if you have any seed scripts.

3. **Start the Development Server**
   ```bash
   npx nodemon src/server.js
   ```

4. **Verify Backend is Running**
   Open http://localhost:5000/health to check server status.

## Future ML Integration
The boilerplate integrates an `MLService` found in `src/services/ml.service.js`. This is pre-configured to send requests to an external FastAPI endpoint. Be sure to configure the `ML_SERVICE_URL` environment variable properly in production.
