<div align="center">

# 🚑 ERIS — Emergency Response Intelligent System

**Real-Time Ambulance Dispatch, Hospital Coordination, & AI Fleet Telemetrics**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.3-FF4B4B?logo=streamlit&logoColor=white)](https://streamlit.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

ERIS is a modern, modular emergency response platform that connects **patients**, **ambulance drivers**, **hospitals**, and **fleet administrators** in real-time. It enables instant ambulance dispatch, live GPS tracking, intelligent hospital routing, asynchronous queue management, and centralized capacity telemetry — all distributed across three decoupled microservice architectures.

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack Architecture](#-tech-stack-architecture)
- [Project Structure](#-project-structure)
- [Getting Started (Local Development)](#-getting-started)
- [Application Flow & Roles](#-application-flow--roles)
- [Design System](#-design-system)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🔍 Overview

ERIS is structured as a full-stack **monorepo** consisting of three distinct services:
1. **Frontend (React/Vite)**: The primary web portal connecting patients initiating rescues, drivers navigating to incidents, and hospitals receiving incoming casualties.
2. **Backend Engine (Node.js/Express)**: A highly-scalable server layer managing JWT authentication, relational hospital/ambulance data via Prisma & PostgreSQL, real-time WebSocket communication (Socket.IO), and asynchronous queue processing (BullMQ) for high-load distress handling.
3. **Admin Dashboard (Python/Streamlit)**: A futuristic, cyberpunk command-center used by top-level fleet administrators to monitor holistic system telemetry, distress vectors, active nodes, and predictive routing models via interactive Plotly visuals.

---

## ✨ Key Features

### 🌐 Patient & Dispatch Portal (Frontend)
- **Live Patient Geolocation** via Browser APIs and Reverse Geocoding (Nominatim).
- **Interactive Topographic Maps** tracking live fleet assets (Leaflet/Overpass API).
- **Role-based Staff Authentication** isolating UI states for drivers and hospital admins.
- **Dynamic Hospital Querying** highlighting real-time ER capacities within a sliding geographic radius.

### ⚙️ Core Engine (Backend)
- **Clean Architecture Principles**, thoroughly decoupled domain logic dividing ambulance, hospital, request, and tracking modules.
- **Real-time Synchronization** powered by `Socket.IO` to broadcast ambulance coordinate deltas to hospitals immediately.
- **Asynchronous Task Queueing** powered by `BullMQ` & Redis to safely handle distressed surges without network timeouts.
- **Production-Ready Relational Schemas** orchestrated smoothly via `Prisma ORM` atop `PostgreSQL`.

### ⚡ Fleet Telemetrics (Admin Dashboard)
- **Wide-screen Sci-Fi Interface**, powered purely by Streamlit overridden with heavy custom CSS injections for a glowing neon-glassmorphic aesthetic.
- **Temporal Latency Matrices** and Distress Vector correlations mapped interactively via `Plotly` graphs.
- **Node & Fleet Unit Matrices** providing filterable views of active assets, sorties, and facility triage capacities.
- **Live System Compliance Logs** simulating a constant event-driven cyber feed.

---

## 🛠 Tech Stack Architecture

### 1️⃣ Frontend (`/frontend`)
| Technology             | Role                                                        |
|------------------------|-------------------------------------------------------------|
| **React 19 & Vite 7**  | Core UI rendering and development builder.                  |
| **Leaflet & React-Leaflet** | Interactive map generation and live GPS coordinate plotting.|
| **Vanilla CSS**        | Robust custom design system leveraging variables and dark/light scopes. |

### 2️⃣ Backend (`/backend`)
| Technology             | Role                                                        |
|------------------------|-------------------------------------------------------------|
| **Node.js & Express**  | Fast, non-blocking REST API routing.                        |
| **PostgreSQL & Prisma**| Type-safe ORM mutations over a relational SQL backbone.     |
| **Socket.IO**          | Full-duplex WebSocket connections for live trip updates.    |
| **BullMQ & Redis**     | Background task buffering and delayed notifications.        |

### 3️⃣ Admin Dashboard (`/admin-dashboard`)
| Technology             | Role                                                        |
|------------------------|-------------------------------------------------------------|
| **Python 3 & Streamlit**| Rapid data-application building framework.                  |
| **Plotly**             | High-performance interactive visualizations.                 |
| **Pandas**             | Matrix generation and dataframe mutations.                  |

---

## 📁 Project Structure

```
ERIS-Emergency-Response-Intelligent-System/
├── LICENSE
├── README.md
├── frontend/               # User-facing React application
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/                # Pages (Home, Patient, Driver, Hospital, Login)
├── backend/                # Core system APIs & Websockets
│   ├── package.json
│   ├── prisma/             # Database Schemas & Migrations
│   ├── src/
│   │   ├── modules/        # Domain-driven feature sets (auth, admin, tracking)
│   │   ├── app.js          # Express middleware bindings
│   │   └── server.js       # App entry point + Socket/Redis initialization
└── admin-dashboard/        # Fleet Telemetrics
    ├── requirements.txt    
    ├── fake_history.py     # Git simulations
    └── app.py              # Single-file Streamlit neon dashboard
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.10+)
- **PostgreSQL** & **Redis** running locally (or via Docker)

### 1. Start the Backend API
```bash
cd backend
npm install
# Set your DATABASE_URL and REDIS_URL in a local .env file
npx prisma migrate dev
npm run dev
```
*The server will start on port `5000`.*

### 2. Start the Frontend Application
```bash
cd frontend
npm install
npm run dev
```
*The client will start on port `5173`.*

### 3. Start the Admin Dashboard
```bash
cd admin-dashboard
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
streamlit run app.py --server.port 8501
```
*The command center will start on port `8501`.*

---

## 👥 Application Flow & Roles

| Service      | Route             | Audience              | Responsibility                                          |
|--------------|-------------------|-----------------------|---------------------------------------------------------|
| **Frontend** | `/`               | Everyone              | Request emergency care, search hospitals.               |
| **Frontend** | `/patient`        | Patients              | Dedicated EMS booking form.                             |
| **Frontend** | `/driver`         | Drivers               | In-cab GPS tracking and dispatch control loop.          |
| **Frontend** | `/hospital`       | Hospital Triage       | Manage incoming casualties and update bed capacities.   |
| **Admin**    | `localhost:8501`  | Fleet Commanders      | Oversee routing models, latency, and global status.     |

---

## 🎨 Design System

ERIS heavily utilizes a highly specific, unified aesthetic across all services.
- **Frontend / Patient Apps**: Clean, high-contrast accessible layouts designed for readability during panic. Built using a light/dark CSS custom property architecture (`--emergency-red`, `--dept-blue`).
- **Admin Dashboard**: Explicit sci-fi cyberpunk visual language. Enforced entirely via custom injected CSS overrides using radial dark-navy background gradients, Space Grotesk typography, glassmorphism (`backdrop-filter: blur(12px)`), and neon cyan glowing borders.

---

## 🗺 Roadmap

- [x] Backend API integration (Node.js/Express)
- [x] Real-time WebSocket communication between driver and patient
- [x] Streamlit Admin Dashboard (Fleet Telemetrics)
- [ ] User authentication with JWT tokens fully wired to Frontend
- [ ] Machine Learning predictive ETA models via Python
- [ ] Push notifications & SMS integrations
- [ ] Accessibility (WCAG 2.1 AA compliance)

---

## 📄 License & Authors

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Developed originally by **MadhavS123-cloud** & **Santanu-SP**.

<div align="center">
<br />
<b>⚡ ERIS — Because Every Second Counts ⚡</b>
</div>
