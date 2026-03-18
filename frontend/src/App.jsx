import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ErisProvider } from './context/ErisContext';
import FloatingBookButton from './components/FloatingBookButton';

import HomePage from './pages/HomePage';
import PatientPage from './pages/PatientPage';
import DriverPage from './pages/DriverPage';
import HospitalPage from './pages/HospitalPage';
import LoginPage from './pages/LoginPage';
import TrackPage from './pages/TrackPage';

function App() {
  return (
    <ThemeProvider>
      <ErisProvider>
        <Router>
          <div className="app-container">
            <FloatingBookButton />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/patient" element={<PatientPage />} />
              <Route path="/track" element={<TrackPage />} />
              <Route path="/driver" element={<DriverPage />} />
              <Route path="/hospital" element={<HospitalPage />} />
            </Routes>
          </div>
        </Router>
      </ErisProvider>
    </ThemeProvider>
  );
}

export default App;
