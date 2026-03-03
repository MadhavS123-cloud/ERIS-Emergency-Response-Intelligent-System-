import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PatientPage from './pages/PatientPage';
import DriverPage from './pages/DriverPage';
import HospitalPage from './pages/HospitalPage';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <Router>
      <div className="app-container">
        {/* Navigation is now handled within pages or via a cleaner mechanism */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/patient" element={<PatientPage />} />
          <Route path="/driver" element={<DriverPage />} />
          <Route path="/hospital" element={<HospitalPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
