import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <ThemeProvider>
      <Toaster position="top-center" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff', fontSize: '14px', borderRadius: '8px', padding: '12px 16px', fontWeight: 600 } }} />
      <ErisProvider>
        <Router>
          <div className="app-container">
            <FloatingBookButton />
            <Routes>
              <Route path="/" element={<EmergencyPage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/patient" element={<PatientPage />} />
              <Route path="/track" element={<TrackPage />} />
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
