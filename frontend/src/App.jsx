import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { ErisProvider } from './context/ErisContext';
import FloatingBookButton from './components/FloatingBookButton';
import authService from './services/authService';

import EmergencyPage from './pages/EmergencyPage';
import HomePage from './pages/HomePage';
import PatientPage from './pages/PatientPage';
import DriverPage from './pages/DriverPage';
import HospitalPage from './pages/HospitalPage';
import LoginPage from './pages/LoginPage';
import TrackPage from './pages/TrackPage';

function ProtectedRoute({ children, role }) {
  const user = authService.getUser();
  const token = authService.getToken();
  const allowedRoles = Array.isArray(role) ? role : role ? [role] : [];

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function StaffIsolationRoute({ children }) {
  const user = authService.getUser();
  const token = authService.getToken();

  if (token && user?.role === 'DRIVER') {
    return <Navigate to="/driver" replace />;
  }

  if (token && (user?.role === 'ADMIN' || user?.role === 'HOSPITAL')) {
    return <Navigate to="/hospital" replace />;
  }

  return children;
}

function EmergencyResumeGate() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = authService.getToken();
    const user = authService.getUser();

    // Never auto-redirect staff sessions into patient tracking.
    if (token && (user?.role === 'DRIVER' || user?.role === 'ADMIN' || user?.role === 'HOSPITAL')) {
      return;
    }

    // Don't hijack explicit track/login routes.
    if (location.pathname === '/track' || location.pathname === '/login') {
      return;
    }

    const raw = localStorage.getItem('eris:lastEmergencyTrack');
    if (!raw) return;

    try {
      const { url, at } = JSON.parse(raw);
      if (!url || typeof url !== 'string') return;
      const ageMs = typeof at === 'number' ? (Date.now() - at) : Infinity;
      // Resume window: 12 hours.
      if (ageMs > 12 * 60 * 60 * 1000) return;

      navigate(url, { replace: true });
    } catch {
      // Ignore malformed storage
    }
  }, [location.pathname, navigate]);

  return null;
}

function App() {
  return (
    <ThemeProvider>
      <Toaster
        position="bottom-right"
        containerStyle={{ bottom: 16, right: 16 }}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--bg-panel)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            borderRadius: '6px',
            padding: '12px 14px',
            fontWeight: 500,
            border: '0.5px solid var(--border-strong)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            maxWidth: 360,
          },
        }}
      />
      <ErisProvider>
        <Router>
          <div className="app-container">
            <EmergencyResumeGate />
            <FloatingBookButton />
            <Routes>
              <Route path="/" element={<StaffIsolationRoute><EmergencyPage /></StaffIsolationRoute>} />
              <Route path="/home" element={<StaffIsolationRoute><HomePage /></StaffIsolationRoute>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/patient" element={<StaffIsolationRoute><PatientPage /></StaffIsolationRoute>} />
              <Route path="/track" element={<StaffIsolationRoute><TrackPage /></StaffIsolationRoute>} />
              <Route path="/driver" element={<ProtectedRoute role="DRIVER"><DriverPage /></ProtectedRoute>} />
              <Route path="/hospital" element={<ProtectedRoute role={['ADMIN', 'HOSPITAL']}><HospitalPage /></ProtectedRoute>} />
            </Routes>
          </div>
        </Router>
      </ErisProvider>
    </ThemeProvider>
  );
}

export default App;
