import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getOrGenerateDeviceId } from '../utils/fingerprint';
import API_BASE_URL from '../config/api';

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
      if (!response.ok) {
        if (response.status === 429) throw new Error(data.message);
        throw new Error((data.message || 'Server error. Use fallback!') + ' Please Call 108.');
      }
      const trackUrl = `/track?id=${data.data.id}&guest=true`;
      localStorage.setItem('eris:lastEmergencyTrack', JSON.stringify({ url: trackUrl, at: Date.now() }));
      navigate(trackUrl);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&display=swap');

        .landing-root {
          min-height: 100dvh;
          width: 100%;
          display: flex;
          flex-direction: column;
          background-color: #0a0a0c;
          background-image: radial-gradient(circle at 50% 0%, rgba(30,30,36,0.6) 0%, transparent 60%);
          color: #f9fafb;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        .landing-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 56px;
          padding: 0 16px;
          background-color: #0d0d10;
          border-bottom: 1px solid #1e1e24;
          flex-shrink: 0;
          box-sizing: border-box;
        }

        .landing-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .landing-logo img {
          height: 24px;
        }

        .landing-logo-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 20px;
          color: #f9fafb;
          letter-spacing: 0.05em;
        }

        .landing-nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .gps-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.1em;
          border: 1px solid #1e1e24;
          background: #111114;
          color: #6b7280;
          text-transform: uppercase;
        }

        .gps-pill[data-status="ready"] {
          border-color: rgba(16,185,129,0.3);
          color: #10b981;
        }

        .gps-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        @keyframes pulse-dot {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16,185,129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 4px rgba(16,185,129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16,185,129, 0); }
        }

        .gps-pill[data-status="acquiring"] .gps-dot {
          background: #f59e0b;
        }

        .gps-pill[data-status="denied"] .gps-dot {
          background: #ff4444;
        }

        .nav-login {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #9ca3af;
          text-decoration: none;
          padding: 6px 12px;
          border: 1px solid #1e1e24;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .nav-login:hover {
          color: #f9fafb;
          border-color: #f9fafb;
        }

        .landing-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          gap: 24px;
          box-sizing: border-box;
          max-height: calc(100vh - 56px);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          color: #10b981;
          letter-spacing: 0.05em;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          animation: pulse-dot 2s infinite;
        }

        .hero-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 52px;
          line-height: 1.1;
          text-align: center;
          margin: 0;
          color: #f9fafb;
          letter-spacing: 0.02em;
        }

        .hero-accent {
          color: #E8251A;
        }

        .hero-subtext {
          font-size: 15px;
          color: #6b7280;
          text-align: center;
          max-width: 280px;
          margin: 0;
          line-height: 1.5;
        }

        .primary-cta {
          width: 100%;
          max-width: 360px;
          height: 58px;
          background: #E8251A;
          color: #f9fafb;
          border: none;
          border-radius: 6px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 20px;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }

        .primary-cta:hover:not(:disabled) {
          background: #c41f15;
        }

        .primary-cta:active:not(:disabled) {
          transform: scale(0.98);
        }

        .primary-cta:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .stats-row {
          display: flex;
          width: 100%;
          max-width: 360px;
          background: #111114;
          border: 1px solid #1e1e24;
          border-radius: 8px;
          padding: 12px;
          box-sizing: border-box;
          justify-content: space-between;
          align-items: center;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: #6b7280;
          text-align: center;
          flex: 1;
        }

        .stat-divider {
          width: 1px;
          height: 24px;
          background: #1e1e24;
        }

        .secondary-actions {
          display: flex;
          width: 100%;
          max-width: 360px;
          gap: 12px;
        }

        .secondary-btn {
          flex: 1;
          height: 48px;
          background: transparent;
          border: 1px solid #1e1e24;
          border-radius: 6px;
          color: #9ca3af;
          font-size: 13px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition: border-color 0.2s, color 0.2s;
        }

        .secondary-btn:hover {
          border-color: #E8251A;
          color: #f9fafb;
        }

        .error-msg {
          color: #E8251A;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>

      <div className="landing-root">
        <header className="landing-nav">
          <Link to="/home" className="landing-logo">
            <img src="/image.png" alt="ERIS" />
            <span className="landing-logo-text">ERIS</span>
          </Link>
          <div className="landing-nav-right">
            <span className="gps-pill" data-status={locationStatus}>
              <span className="gps-dot" />
              {locationStatus === 'ready' ? 'GPS Ready' : locationStatus === 'denied' ? 'No GPS' : 'Locating…'}
            </span>
            <Link to="/login" className="nav-login">Staff Login</Link>
          </div>
        </header>

        <main className="landing-main">
          <div className="status-badge">
            <span className="status-dot" />
            24/7 EMERGENCY DISPATCH
          </div>

          <h1 className="hero-title">
            Emergency<br />
            <span className="hero-accent">Response System</span>
          </h1>

          <p className="hero-subtext">
            One tap dispatches the nearest ambulance to your exact location.
          </p>

          {error && (
            <div className="error-msg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button className="primary-cta" onClick={handlePanicClick} disabled={loading}>
            {loading ? (
              'DISPATCHING...'
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 17h.01M14 17h.01M22 13h-4l-2-2H8l-2 2H2v7h20v-7ZM6 13V8l4-4h4l4 4v5"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg>
                REQUEST EMERGENCY HELP
              </>
            )}
          </button>

          <div className="stats-row">
            <div className="stat-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Avg. 5 min response
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              GPS auto-detected
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Nearest hospital routed
            </div>
          </div>

          <div className="secondary-actions">
            <Link to="/home" className="secondary-btn">HOMEPAGE</Link>
            <Link to="/patient" className="secondary-btn">Book With Details</Link>
          </div>
        </main>
      </div>
    </>
  );
}
