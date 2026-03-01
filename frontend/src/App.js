import logo from './logo.svg';
import './App.css';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PatientPage from './pages/PatientPage';
import DriverPage from './pages/DriverPage';
import HospitalPage from './pages/HospitalPage';

function App() {
  return (
    <Router>
      <div style={{ padding: "20px" }}>
        <h1>Emergency Response Intelligent System (ERIS)</h1>

        <nav>
          <Link to="/">Home</Link>
          <Link to="/patient">Patient</Link>
          <Link to="/driver">Driver</Link>
          <Link to="/hospital">Hospital</Link>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/patient" element={<PatientPage />} />
          <Route path="/driver" element={<DriverPage />} />
          <Route path="/hospital" element={<HospitalPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
