import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrGenerateDeviceId } from '../utils/fingerprint';
import './EmergencyPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export default function EmergencyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn('GPS Error', err),
        { enableHighAccuracy: true, timeout: 5000 }
      );
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
             (err) => resolve(), 
             { timeout: 3000 }
           );
         });
      }

      const response = await fetch(`${API_URL}/emergency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': deviceId
        },
        body: JSON.stringify({
          locationLat: reqLat,
          locationLng: reqLng,
          deviceId,
          emergencyType: 'Panic SOS'
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
         throw new Error(data.message || 'Server error. Use fallback!');
      }

      navigate(`/track?id=${data.data.id}&guest=true`);
      
    } catch (err) {
      setError(err.message + ' Please Call 108.');
      setLoading(false);
    }
  };

  return (
    <div className="emergency-container">
      <div className="emergency-header">
        <h1>ERIS Emergency</h1>
        <p>Act first. Verify later.</p>
      </div>

      <div className="emergency-actions">
        {error && <div className="error-msg">{error}</div>}
        
        <button 
           className="btn-panic" 
           onClick={handlePanicClick} 
           disabled={loading}
        >
          {loading ? <div className="loader"></div> : <>🚑 Request Help Now</>}
        </button>

        <a href="tel:108" className="btn-fallback">
          📞 Call 108 (Fallback)
        </a>
      </div>
      
      <div style={{ marginTop: '3rem' }}>
         <a href="/home" style={{ color: '#94a3b8', fontSize: '0.9rem', textDecoration: 'none' }}>Access Dashboard / Login &rarr;</a>
      </div>
    </div>
  );
}
