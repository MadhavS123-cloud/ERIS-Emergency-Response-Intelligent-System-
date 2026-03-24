<div align="center">

# 🚑 ERIS — Emergency Response Intelligent System

**Real-Time Ambulance Dispatch & Hospital Coordination Platform**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)

ERIS is a modern, full-featured emergency response web application that connects **patients**, **ambulance drivers**, and **hospitals** in real-time. It enables instant ambulance dispatch, live GPS tracking, intelligent hospital routing, and centralized capacity management — all through a professional, role-based interface.

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Application Pages & Roles](#-application-pages--roles)
- [Design System](#-design-system)
- [Screenshots](#-screenshots)
- [Roadmap](#-roadmap)
- [License](#-license)
- [Author](#-author)

---

## 🔍 Overview

ERIS (Emergency Response Intelligent System) is a single-page web application built to simulate and prototype a modern ambulance dispatch platform. The system connects three types of users — **patients**, **ambulance drivers**, and **hospital staff** — through dedicated dashboards, each tailored for their role in the emergency response chain.

At its core, ERIS demonstrates:
- **Patient-initiated emergency requests** with auto-detected GPS location
- **Live map-based ambulance tracking** using Leaflet and the Geolocation API
- **Hospital dashboard** for monitoring incoming ambulances and managing bed capacity
- **Role-based login** for staff (drivers and hospital admins)

---

## ✨ Key Features

### 🏠 Landing Page (HomePage)
- **Hero Section** with emergency call-to-action buttons for booking an ambulance or tracking one
- **24/7 Emergency Dispatch badge** with live status indicator
- **National Emergency Hotline** contact display (112 / 1800-ERIS-112)
- **How It Works** — 3-step visual guide (Request → Track → Get Treatment)
- **Live Statistics Dashboard** — Average response time, availability metrics, fleet size, and partner hospitals
- **Real-Time Nearby Hospitals Section**:
  - Dynamically fetches **real hospitals** from the [Overpass API](https://overpass-api.de/) within a 15 km radius of the user's GPS location
  - Displays each hospital's name, distance (Haversine formula), mock bed availability, and ER readiness status
  - Sorts hospitals by proximity, with priority promotion for well-known facilities
  - **Interactive Leaflet Map** with live GPS coordinates, custom patient marker, and hospital markers with popups
- **Emergency CTA Banner** — Bottom-of-page call to action for immediate ambulance booking
- **Floating "Book Ambulance" Button** — Persistent overlay on all pages for instant access

### 📝 Patient Emergency Form (PatientPage)
- **Auto-detected pickup location** using the browser's Geolocation API
- **Reverse geocoding** via [Nominatim (OpenStreetMap)](https://nominatim.openstreetmap.org/) to convert GPS coordinates into a human-readable address
- **Interactive mini-map** showing the patient's live location on a Leaflet map
- **Emergency form fields**:
  - Patient Name
  - Contact Number
  - Emergency Type (Cardiac Arrest, Trauma/Accident, Stroke, Respiratory, Other)
  - Auto-filled Pickup Address
  - Additional Medical Notes (optional)
- **Animated Dispatch Confirmation Modal**:
  - Pulsing siren animation
  - ETA badge (5–10 minutes estimate)
  - "While you wait" tips for the patient
  - Smooth overlay and slide-up animations

### 🚑 Driver Dashboard (DriverPage)
- **Full-screen Leaflet map** with real-time GPS tracking of the ambulance
  - Custom ambulance icon for the driver's position
  - Custom patient icon at the pickup location
  - Animated dashed route line between driver and patient
  - Auto-follow mode that pans the map to the driver's location during active trips
- **Trip Control Panel** (collapsible side panel):
  - Dispatch Request ID
  - Patient name, age, emergency type
  - Pickup address and destination hospital
  - Trip status workflow: `IDLE → STARTED → ARRIVED → COMPLETED`
  - System status indicators (GPS sync, last updated timestamp)
- **Sidebar navigation** with ERIS branding, navigation tabs, and system logout
- **Responsive design** with mobile panel handle for touch interaction

### 🏥 Hospital Dashboard (HospitalPage)
- **Emergency Command Portal** with facility name, dispatch protocol, and network sync status
- **Incoming Ambulance Dispatch Records** — data table displaying:
  - Patient ID
  - Priority level (CRITICAL / HIGH) with color-coded badges
  - Emergency diagnosis
  - EMS Unit (ambulance ID)
  - Estimated Time of Arrival
  - Action buttons (Assign Unit)
- **Facility Capacity Management**:
  - Editable fields for ICU beds, General beds, and Ventilators
  - "Confirm & Sync Update" button to push capacity changes to the central server
  - Timestamped last sync indicator
- **Dispatch Briefing Feed** — placeholder for radio communications log
- **Responsive sidebar** with mobile hamburger menu toggle

### 🔐 Staff Login Page (LoginPage)
- **Role-based access control**:
  - Hospital Authority / Admin
  - EMS Unit / Ambulance Driver
- **Professional login form** with:
  - Role selector dropdown
  - System username (ERIS ID) input with user icon
  - Password input with lock icon
  - "Remember access" checkbox
  - "Reset Network Pin" link
- **Branded header** with ERIS logo and "Secure Staff Portal" subtitle
- **Back to Home** navigation link
- Routes users to the correct dashboard based on selected role

### 🎨 Global UI/UX Features
- **Custom Design System** with CSS variables for colors, spacing, typography, shadows, and radii
- **Light & Dark theme support** via `ThemeContext` (CSS variables swap between `.light-theme` and `.dark-theme`)
- **Google Fonts** — Montserrat (headings) + Roboto (body text)
- **Smooth animations** — fade-in, slide-up, pulse effects, and hover micro-interactions
- **Responsive layouts** — mobile-first approach with collapsible sidebars and panels
- **Glassmorphism effects** — frosted glass panels with backdrop blur
- **Floating Book Ambulance button** — available globally on every page for instant emergency access

---

## 🛠 Tech Stack

| Layer       | Technology                                                 |
|-------------|-------------------------------------------------------------|
| **Frontend Framework** | React 19 with functional components & hooks       |
| **Build Tool**         | Vite 7                                             |
| **Routing**            | React Router DOM v7                                |
| **Maps**               | Leaflet 1.9.4 (loaded via CDN)                     |
| **Geolocation**        | Browser Geolocation API                            |
| **Reverse Geocoding**  | Nominatim (OpenStreetMap)                          |
| **Hospital Data**      | Overpass API (real-time OpenStreetMap POI queries)  |
| **Styling**            | Vanilla CSS with CSS Custom Properties (variables) |
| **Typography**         | Google Fonts (Montserrat, Roboto)                  |
| **Testing**            | Vitest + React Testing Library                     |
| **License**            | MIT                                                |

---

## 📁 Project Structure

```
ERIS-Emergency-Response-Intelligent-System/
├── LICENSE
├── README.md
└── frontend/
    ├── index.html                  # Entry HTML with Leaflet CDN
    ├── package.json                # Dependencies & scripts
    ├── vite.config.js              # Vite configuration
    ├── public/
    │   ├── logo192.png             # App icon (192x192)
    │   ├── logo512.png             # App icon (512x512)
    │   ├── manifest.json           # PWA manifest
    │   └── robots.txt
    └── src/
        ├── index.jsx               # App entry point
        ├── index.css               # Global design system & CSS variables
        ├── App.jsx                 # Root component with Router & ThemeProvider
        ├── context/
        │   └── ThemeContext.jsx     # Theme state management (light/dark)
        ├── pages/
        │   ├── HomePage.jsx        # Landing page with hero, hospitals, map
        │   ├── HomePage.css
        │   ├── PatientPage.jsx     # Patient emergency booking wrapper
        │   ├── DriverPage.jsx      # Driver dashboard wrapper
        │   ├── DriverPage.css
        │   ├── HospitalPage.jsx    # Hospital dashboard wrapper
        │   ├── HospitalPage.css
        │   ├── LoginPage.jsx       # Role-based staff login
        │   └── LoginPage.css
        └── components/
            ├── EmergencyForm.jsx       # Patient emergency request form + dispatch modal
            ├── EmergencyForm.css
            ├── DriverDashboard.jsx     # Full driver tracking interface
            ├── DriverDashboard.css
            ├── HospitalDashboard.jsx   # Hospital command control panel
            ├── HospitalDashboard.css
            ├── FloatingBookButton.jsx  # Global floating CTA button
            └── BackButton.jsx          # Reusable back navigation button
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/MadhavS123-cloud/ERIS-Emergency-Response-Intelligent-System-.git
   cd ERIS-Emergency-Response-Intelligent-System-
   ```

2. **Navigate to the frontend directory:**

   ```bash
   cd frontend
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Start the development server:**

   ```bash
   npm run dev
   ```

5. **Open the app** in your browser at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The optimized production bundle will be output to the `frontend/dist/` directory.

### Preview Production Build

```bash
npm run preview
```

---

## 👥 Application Pages & Roles

| Route        | Page              | Audience              | Description                                               |
|--------------|-------------------|-----------------------|-----------------------------------------------------------|
| `/`          | Home Page         | Everyone              | Landing page with hero, nearby hospitals, and live map    |
| `/patient`   | Patient Page      | Patients / Public     | Emergency ambulance booking form with auto-location       |
| `/login`     | Login Page        | Staff (Driver/Admin)  | Role-based authentication portal                          |
| `/driver`    | Driver Dashboard  | Ambulance Drivers     | Real-time GPS navigation and trip control interface       |
| `/hospital`  | Hospital Dashboard| Hospital Admins       | Incoming dispatch monitoring and capacity management      |

### User Flow

```
Patient Flow:     Home → Book Ambulance → Emergency Form → Dispatch Confirmation
Driver Flow:      Home → Staff Login (Driver) → Driver Dashboard → Start/Arrive/Complete Trip
Hospital Flow:    Home → Staff Login (Hospital) → Hospital Dashboard → Monitor & Manage
```

---

## 🎨 Design System

ERIS uses a comprehensive design token system built with **CSS Custom Properties** for consistency and easy theming.

### Color Palette

| Token                   | Light Mode  | Dark Mode   | Usage                        |
|-------------------------|-------------|-------------|------------------------------|
| `--emergency-red`       | `#ef4444`   | `#f87171`   | Emergency actions, alerts    |
| `--dept-blue`           | `#2563eb`   | `#3b82f6`   | Primary actions, links       |
| `--success-green`       | `#10b981`   | `#10b981`   | Success states, GPS sync     |
| `--warning-orange`      | `#f59e0b`   | `#f59e0b`   | Warning states, limited beds |
| `--bg-main`             | `#f8fafc`   | `#0f172a`   | Page background              |
| `--bg-card`             | `#ffffff`   | `#1e293b`   | Card surfaces                |
| `--text-primary`        | `#0f172a`   | `#f8fafc`   | Primary text color           |

### Typography

- **Headings:** Montserrat (weight 800, tight letter-spacing)
- **Body:** Roboto (weight 400, 1.6 line-height)
- **Scale:** 12px (`--text-xs`) → 44px (`--text-6xl`)

### Component Classes

| Class            | Description                                        |
|------------------|----------------------------------------------------|
| `.btn-emergency` | Red gradient button with glow shadow               |
| `.btn-secondary` | Blue gradient button with glow shadow              |
| `.card-std`      | Standard card with border, shadow, and hover lift  |
| `.glass-panel`   | Frosted glass panel with backdrop blur             |
| `.live-dot`      | Pulsing green/red status indicator dot             |

---

## 🗺 Roadmap

- [ ] Backend API integration (Node.js/Express or Python/FastAPI)
- [ ] Real-time WebSocket communication between driver and patient
- [ ] User authentication with JWT tokens
- [ ] Push notifications for dispatch updates
- [ ] SMS/Call integration for emergency alerts
- [ ] Admin analytics dashboard with historical data
- [ ] Multi-language support (i18n)
- [ ] Progressive Web App (PWA) with offline support
- [ ] Accessibility (WCAG 2.1 AA compliance)
- [ ] Payment integration for ambulance services

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**MadhavS123-cloud**
**Santanu-SP**
---

<div align="center">

**⚡ ERIS — Because Every Second Counts ⚡**

</div>
