import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

function PatientPage() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [verificationStep, setVerificationStep] = useState('phone'); // 'phone' or 'code'
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [timer, setTimer] = useState(27);

    const [isTracking, setIsTracking] = useState(false);
    const mapContainer = useRef(null);
    const mapInstance = useRef(null);

    const selectMapContainer = useRef(null);
    const selectMapInstance = useRef(null);
    const selectMarkerInstance = useRef(null);

    // Form States
    const [emergencyType, setEmergencyType] = useState('');
    // Storing coordinates as location
    const [location, setLocation] = useState([12.9716, 77.5946]); // Default to Bangalore
    const [address, setAddress] = useState('Fetching address...');

    // Reverse Geocoding Effect
    useEffect(() => {
        const fetchAddress = async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location[0]}&lon=${location[1]}`);
                const data = await response.json();
                if (data && data.display_name) {
                    // Split to make it a bit shorter and more readable if needed, or just use the full string.
                    const shortAddress = data.display_name.split(',').slice(0, 3).join(', ');
                    setAddress(shortAddress || data.display_name);
                } else {
                    setAddress('Unknown Location');
                }
            } catch (err) {
                console.error("Failed to fetch address", err);
                setAddress('Location Details Unavailable');
            }
        };
        fetchAddress();
    }, [location]);

    // Auto-detect patient location on page load
    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const newLoc = [position.coords.latitude, position.coords.longitude];
                    setLocation(newLoc);
                    if (selectMapInstance.current && selectMarkerInstance.current) {
                        selectMapInstance.current.setView(newLoc, 15);
                        selectMarkerInstance.current.setLatLng(newLoc);
                    }
                },
                (err) => console.error("Patient location detection error:", err),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    }, []);

    // Coordinates for live tracking (Ambulance simulated slightly away)
    const patientCoords = location;
    const initialAmbulanceCoords = [location[0] + 0.012, location[1] - 0.009];

    const handleRequest = (e) => {
        e.preventDefault();
        setIsTracking(true);
    };

    useEffect(() => {
        let interval;
        if (!isLoggedIn && verificationStep === 'code' && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [verificationStep, timer, isLoggedIn]);

    useEffect(() => {
        if (!isTracking || !mapContainer.current) return;

        let aMarker;
        let pMarker;
        let routeLine;
        let moveInterval;

        if (!mapInstance.current) {
            // Init map
            mapInstance.current = window.L.map(mapContainer.current, {
                zoomControl: true,
                attributionControl: false
            }).setView(patientCoords, 14);

            window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(mapInstance.current);

            // Patient Icon
            const patientIcon = window.L.divIcon({
                className: 'custom-patient-icon',
                html: `
                  <div style="
                    background-color: white; 
                    width: 16px; 
                    height: 16px; 
                    border-radius: 50%; 
                    border: 4px solid #16a34a;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                  "></div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            // Ambulance Icon
            const ambulanceIcon = window.L.divIcon({
                className: 'custom-amb-icon',
                html: `
                  <div style="
                    background-color: white; 
                    border: 3px solid #C62828; 
                    color: #C62828; 
                    width: 32px; 
                    height: 32px; 
                    border-radius: 50%; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                  ">🚑</div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            pMarker = window.L.marker(patientCoords, { icon: patientIcon }).addTo(mapInstance.current);
            aMarker = window.L.marker(initialAmbulanceCoords, { icon: ambulanceIcon }).addTo(mapInstance.current);

            // Draw Route
            const latlngs = [patientCoords, initialAmbulanceCoords];
            routeLine = window.L.polyline(latlngs, {
                color: '#3b82f6',
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 10'
            }).addTo(mapInstance.current);

            // Fit bounds
            mapInstance.current.fitBounds(window.L.latLngBounds(latlngs), { padding: [30, 30] });

            // Simulate Ambulance Movement
            let currentAmbLat = initialAmbulanceCoords[0];
            let currentAmbLng = initialAmbulanceCoords[1];

            moveInterval = setInterval(() => {
                // Move 5% closer each tick
                const latDiff = patientCoords[0] - currentAmbLat;
                const lngDiff = patientCoords[1] - currentAmbLng;

                currentAmbLat += latDiff * 0.05;
                currentAmbLng += lngDiff * 0.05;

                const newLatLng = [currentAmbLat, currentAmbLng];
                aMarker.setLatLng(newLatLng);
                routeLine.setLatLngs([patientCoords, newLatLng]);
            }, 3000); // update every 3 seconds
        }

        return () => {
            if (moveInterval) clearInterval(moveInterval);
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [isTracking]);

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f4f7f9', paddingBottom: '40px', fontFamily: '"Inter", "Roboto", sans-serif' }}>
            {/* Header */}
            <header style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Link to="/" style={{ color: '#1e293b', textDecoration: 'none' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
                </Link>
                <div style={{ background: '#C62828', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M10 17h.01" /><path d="M14 17h.01" /><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z" /><path d="M6 13V8l4-4h4l4 4v5" /><circle cx="7" cy="17" r="1" /><circle cx="17" cy="17" r="1" /></svg>
                </div>
                <div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2' }}>ERIS</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{isTracking ? 'Live Tracking' : 'Session: SES-N1ADJ3138'}</div>
                </div>
            </header>

            <main style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
                {!isLoggedIn ? (
                    verificationStep === 'phone' ? (
                        <div style={{ background: 'white', borderRadius: '16px', padding: '32px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
                            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Quick Emergency Access</h1>
                            <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>No signup required - just verify your phone number</p>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                    Mobile Number *
                                </label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', fontSize: '15px', color: '#334155', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        +91
                                    </div>
                                    <input
                                        type="tel"
                                        placeholder="98765 43210"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        style={{ flex: 1, padding: '14px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', color: '#334155', outline: 'none', letterSpacing: '1px' }}
                                    />
                                </div>
                                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>We'll send you a verification code via SMS</div>
                            </div>

                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#1d4ed8', fontWeight: '600', fontSize: '14px', marginBottom: '12px' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                    Your Privacy Matters
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '20px', color: '#1e40af', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <li>No permanent account created</li>
                                    <li>Phone number stored securely (hashed)</li>
                                    <li>Data auto-deleted after 30 days</li>
                                    <li>Temporary session for emergency only</li>
                                </ul>
                            </div>

                            <button
                                onClick={() => setVerificationStep('code')}
                                disabled={phoneNumber.length < 10}
                                style={{ width: '100%', background: '#f87171', color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: phoneNumber.length >= 10 ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: phoneNumber.length >= 10 ? 1 : 0.7 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                Send Verification Code
                            </button>
                        </div>
                    ) : (
                        <div style={{ background: 'white', borderRadius: '16px', padding: '32px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
                            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Enter Verification Code</h1>
                            <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>We sent a 6-digit code to <strong style={{ color: '#334155' }}>+91 {phoneNumber}</strong></p>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
                                    Verification Code
                                </label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value)}
                                        maxLength={6}
                                        style={{ width: '100%', textAlign: 'center', padding: '16px', background: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '20px', color: '#334155', outline: 'none', letterSpacing: '8px', fontWeight: '600' }}
                                    />
                                </div>
                                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '12px', textAlign: 'center' }}>
                                    Code expires in {timer} seconds
                                </div>
                            </div>

                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <button
                                    type="button"
                                    onClick={() => setTimer(30)}
                                    style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                                    Didn't receive code? Resend
                                </button>
                            </div>

                            <button
                                disabled={verificationCode.length < 6}
                                onClick={() => setIsLoggedIn(true)}
                                style={{ width: '100%', background: '#f87171', color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: verificationCode.length === 6 ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: verificationCode.length === 6 ? 1 : 0.7 }}>
                                Verify & Continue
                            </button>
                        </div>
                    )
                ) : !isTracking ? (
                    <>
                        {/* Emergency Hotline Alert */}
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ color: '#C62828', marginTop: '2px' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            </div>
                            <div>
                                <div style={{ color: '#7f1d1d', fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>Emergency Hotline</div>
                                <div style={{ color: '#991b1b', fontSize: '14px' }}>For life-threatening emergencies, call <strong style={{ color: '#b91c1c' }}>112</strong> immediately</div>
                            </div>
                        </div>

                        {/* Request Form Card */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '32px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
                            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Request Emergency Ambulance</h1>
                            <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '32px', lineHeight: '1.5' }}>Fill in the details below. We'll send the nearest available ambulance.</p>

                            <form onSubmit={handleRequest}>
                                {/* Verified Number Field */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Verified Number</div>
                                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>+91 {phoneNumber || '5646556565'}</div>
                                    </div>
                                    <button type="button" onClick={() => { setIsLoggedIn(false); setVerificationStep('phone'); setVerificationCode(''); }} style={{ background: 'white', border: '1px solid #cbd5e1', padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>Logout</button>
                                </div>

                                {/* Emergency Type */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                        Emergency Type *
                                    </label>
                                    <select
                                        required
                                        value={emergencyType}
                                        onChange={(e) => setEmergencyType(e.target.value)}
                                        style={{ width: '100%', padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', color: '#334155', outline: 'none', appearance: 'none' }}>
                                        <option value="" disabled>Select emergency type</option>
                                        <option value="cardiac">Cardiac Arrest / Heart Warning</option>
                                        <option value="accident">Accident / Trauma</option>
                                        <option value="respiratory">Respiratory Issue</option>
                                        <option value="other">Other Medical Emergency</option>
                                    </select>
                                </div>

                                {/* Current Location */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                        Current Location *
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <input
                                                type="text"
                                                readOnly
                                                value={address}
                                                title={address}
                                                style={{ flex: 1, padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', color: '#64748b', outline: 'none', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if ("geolocation" in navigator) {
                                                        navigator.geolocation.getCurrentPosition(
                                                            (position) => {
                                                                const newLoc = [position.coords.latitude, position.coords.longitude];
                                                                setLocation(newLoc);
                                                                if (selectMapInstance.current && selectMarkerInstance.current) {
                                                                    selectMapInstance.current.setView(newLoc, 15);
                                                                    selectMarkerInstance.current.setLatLng(newLoc);
                                                                }
                                                            },
                                                            (err) => console.error(err),
                                                            { enableHighAccuracy: true }
                                                        );
                                                    }
                                                }}
                                                style={{ background: 'white', border: '1px solid #cbd5e1', padding: '0 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: '#0f172a', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                Auto-Detect
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Preferred Hospital */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
                                        Preferred Hospital (Optional)
                                    </label>
                                    <select style={{ width: '100%', padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', color: '#64748b', outline: 'none', appearance: 'none' }}>
                                        <option>Let us choose the nearest available</option>
                                        <option>City General Hospital</option>
                                        <option>St. Mary Medical Centre</option>
                                    </select>
                                </div>



                                {/* Submit Button */}
                                <button type="submit" style={{ width: '100%', background: '#C62828', color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', boxShadow: '0 4px 12px rgba(198, 40, 40, 0.2)' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    Request Ambulance Now
                                </button>

                            </form>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Status Card */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '2px solid #22c55e', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#16a34a', marginBottom: '16px' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Arriving in 4 minutes</h2>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ color: '#64748b', fontSize: '14px' }}>Status:</span>
                                <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 12px', borderRadius: '100px', fontSize: '13px', fontWeight: '700' }}>On the Way</span>
                            </div>

                            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                                <div style={{ width: '75%', height: '100%', background: '#16a34a', borderRadius: '4px' }}></div>
                            </div>

                            <div style={{ color: '#64748b', fontSize: '14px' }}>Distance: 1.8 km remaining</div>
                        </div>

                        {/* Live Location Map Placeholder */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                Live Location
                            </div>

                            <div
                                ref={mapContainer}
                                style={{
                                    height: '240px',
                                    background: '#f8fafc',
                                    border: '2px dashed #cbd5e1',
                                    borderRadius: '12px',
                                    overflow: 'hidden'
                                }}>
                            </div>                        </div>

                        {/* Ambulance Details Card */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '20px' }}>Ambulance Details</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span style={{ color: '#64748b' }}>Vehicle Type:</span>
                                    <span style={{ color: '#0f172a', fontWeight: '600' }}>Mercedes Sprinter</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span style={{ color: '#64748b' }}>Licence Plate:</span>
                                    <span style={{ color: '#0f172a', fontWeight: '600' }}>EMG 7843</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span style={{ color: '#64748b' }}>Driver:</span>
                                    <span style={{ color: '#0f172a', fontWeight: '600' }}>Michael Rodriguez</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span style={{ color: '#64748b' }}>Driver Contact:</span>
                                    <span style={{ color: '#0f172a', fontWeight: '600' }}>+91 98765 43210</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span style={{ color: '#64748b' }}>Crew:</span>
                                    <span style={{ color: '#0f172a', fontWeight: '600' }}>2 Paramedics</span>
                                </div>
                            </div>
                        </div>

                        {/* Your Request */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '20px' }}>Your Request</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span style={{ color: '#64748b' }}>Emergency Type:</span>
                                    <span style={{ color: '#0f172a', fontWeight: '600', textTransform: 'capitalize' }}>{emergencyType || 'General Emergency'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span style={{ color: '#64748b' }}>Pickup Location:</span>
                                    <span style={{ color: '#0f172a', fontWeight: '600', textAlign: 'right', maxWidth: '250px', fontSize: '13px', lineHeight: '1.4' }}>
                                        {address}
                                    </span>
                                </div>

                                <div style={{ borderTop: '1px solid #e2e8f0', margin: '8px 0' }}></div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                                    <span style={{ color: '#16a34a', fontWeight: '700' }}>Estimated Payable Amount:</span>
                                    <span style={{ color: '#16a34a', fontWeight: '800' }}>$450.00</span>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748b' }}>
                                    *To be paid at hospital reception upon arrival
                                </div>
                            </div>
                        </div>

                        {/* Journey Timeline */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '24px' }}>Journey Timeline</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                                {/* Timeline Line */}
                                <div style={{ position: 'absolute', left: '11px', top: '16px', bottom: '16px', width: '2px', background: '#e2e8f0', zIndex: 0 }}></div>

                                {/* Step 1 */}
                                <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dcfce7', border: '2px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>Request Received</div>
                                        <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>2:45 PM • Session created</div>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dcfce7', border: '2px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>Ambulance Sent</div>
                                        <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>2:46 PM • AMB-2451 assigned</div>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#eff6ff', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '15px' }}>On the way to your location</div>
                                        <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>ETA: 4 minutes</div>
                                    </div>
                                </div>

                                {/* Step 4 */}
                                <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'white', border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }}></div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', color: '#94a3b8', fontSize: '15px' }}>Pickup</div>
                                        <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Arriving soon</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                            <button style={{ flex: 1, padding: '16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                Call Driver
                            </button>
                            <button
                                onClick={() => setIsTracking(false)}
                                style={{ flex: 1, padding: '16px', background: 'white', color: '#C62828', border: '1px solid #C62828', borderRadius: '8px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}>
                                Cancel Request
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default PatientPage;
