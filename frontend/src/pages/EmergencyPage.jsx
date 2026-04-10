import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getOrGenerateDeviceId } from '../utils/fingerprint';
import API_BASE_URL from '../config/api';
import './EmergencyPage.css';

export default function EmergencyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('acquiring'); // acquiring | ready | denied

  useEffect(() => {
    document.title = 'ERIS — Emergency Response';
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationStatus('ready');
        },
        () => setLocationStatus('denied'),
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setLocationStatus('denied');
    }
  }, []);

  const handlePanicClick = async () => {
    try {
      setLoading(true);
      setError('');

      const deviceId = await getOrGenerateDeviceId();
      let reqLat = 0, reqLng = 0;

      if (location) {
        reqLat = location.lat;
        reqLng = location.lng;
      } else {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { reqLat = pos.coords.latitude; reqLng = pos.coords.longitude; resolve(); },
            () => resolve(),
            { timeout: 3000 }
          );
        });
      }

      const response = await fetch(`${API_BASE_URL}/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId },
        body: JSON.stringify({ locationLat: reqLat, locationLng: reqLng, deviceId, emergencyType: 'Panic SOS' })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Server error. Use fallback!');
      navigate(`/track?id=${data.data.id}&guest=true`);
    } catch (err) {
      setError(err.message + ' Please Call 108.');
      setLoading(false);
    }
  };

  return (
    <div className="ep-root">

      {/* Top bar */}
      <header className="ep-topbar">
        <Link to="/home" className="ep-logo-link">
          <img src="/image.png" alt="ERIS" className="ep-logo" />
          <span className="ep-logo-text">ERIS</span>
        </Link>
        <div className="ep-topbar-right">
          <span className={`ep-gps-badge ep-gps-badge--${locationStatus}`}>
            <span className="ep-gps-dot" />
            {locationStatus === 'ready' ? 'GPS Ready' : locationStatus === 'denied' ? 'No GPS' : 'Locating…'}
          </span>
          <Link to="/home" className="ep-login-link">Staff Login</Link>
        </div>
      </header>

      {/* Main content */}
      <main className="ep-main">
        {/* Logo + brand */}
        <div className="ep-brand">
          <div className="ep-logo-circle">
            <img src="/image.png" alt="ERIS Logo" className="ep-brand-logo" />
          </div>
          <div className="ep-brand-badge">
            <span className="live-dot" />
            24 / 7 EMERGENCY DISPATCH
          </div>
        </div>

        {/* Headline */}
        <div className="ep-headline">
          <h1 className="ep-title">
            Emergency<br />
            <span className="ep-title-accent">Response System</span>
          </h1>
          <p className="ep-subtitle">One tap dispatches the nearest ambulance to your exact location.</p>
        </div>

        {/* Actions */}
        <div className="ep-actions">
          {error && (
            <div className="ep-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button className="ep-panic-btn" onClick={handlePanicClick} disabled={loading}>
            {loading ? (
              <>
                <div className="ep-spinner" />
                Dispatching…
              </>
            ) : (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 17h.01M14 17h.01M22 13h-4l-2-2H8l-2 2H2v7h20v-7ZM6 13V8l4-4h4l4 4v5"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg>
                Request Emergency Help
              </>
            )}
          </button>

          <a href="tel:108" className="ep-call-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Call 108 — National Ambulance
          </a>
        </div>

        {/* Info strip */}
        <div className="ep-info-strip">
          <div className="ep-info-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Avg. 5 min response
          </div>
          <div className="ep-info-divider" />
          <div className="ep-info-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            GPS auto-detected
          </div>
          <div className="ep-info-divider" />
          <div className="ep-info-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Nearest hospital routed
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="ep-footer">
        <Link to="/home" className="ep-footer-link">
          Staff Dashboard &amp; Login
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Link>
        <span className="ep-footer-sep">·</span>
        <Link to="/patient" className="ep-footer-link">Book with details</Link>
      </footer>
    </div>
  );
}
