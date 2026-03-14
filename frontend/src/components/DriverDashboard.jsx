import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import logoDark from '../assets/logo-dark.png';
import './DriverDashboard.css';

/**
 * Professional Emergency Driver Interface
 * Focuses on reliable location tracking and status updates.
 * Structured by dispatch priority.
 */
function DriverDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('navigation');
    const [tripStatus, setTripStatus] = useState('idle'); // idle, started, arrived, completed
    const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

    // Map Refs
    const mapInstance = useRef(null);
    const driverMarker = useRef(null);
    const patientMarker = useRef(null);
    const routeLine = useRef(null);
    const watchId = useRef(null);

    // Mock Dispatch Data
    const dispatchInfo = {
        requestId: 'REQ-8754-ALPHA',
        patientName: 'SARAH JOHNSON',
        age: '54',
        emergencyType: 'CARDIAC DISTRESS',
        contact: '+91 98765 12345',
        pickupAddress: '456 OAK STREET, DOWNTOWN',
        hospitalName: 'CITY GENERAL EMERGENCY DEPT',
        patientPos: [12.9716, 77.5946]
    };

    // --- Geolocation Tracking Logic ---
    useEffect(() => {
        if (activeTab === 'navigation') {
            initMap();
        }
        return () => cleanupMap();
    }, [activeTab]);

    const initMap = () => {
        if (!window.L) return;

        // Create Map
        mapInstance.current = window.L.map('map', { zoomControl: false }).setView(dispatchInfo.patientPos, 13);

        // Add zoom control at top right
        window.L.control.zoom({ position: 'topright' }).addTo(mapInstance.current);

        // Professional Grayscale Tiles for Map
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO'
        }).addTo(mapInstance.current);

        // Ambulance Marker (Professional Icon)
        const ambulanceIcon = window.L.divIcon({
            className: 'ambulance-icon',
            html: `
                <div style="background: white; border: 3px solid #0D47A1; padding: 4px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#0D47A1" stroke="#0D47A1" stroke-width="1.5"><path d="M10 17h.01"/><path d="M14 17h.01"/><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z"/><path d="M6 13V8l4-4h4l4 4v5"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg>
                </div>
            `,
            iconSize: [40, 40], iconAnchor: [20, 20]
        });

        // Patient Marker (Red Alert Icon)
        const patientIcon = window.L.divIcon({
            className: 'patient-icon',
            html: `
                <div style="background: white; border: 3px solid #C62828; padding: 4px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#C62828" stroke="#C62828" stroke-width="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
            `,
            iconSize: [40, 40], iconAnchor: [20, 20]
        });

        // Initial Location Logic
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const driverPos = [pos.coords.latitude, pos.coords.longitude];
                mapInstance.current.setView(driverPos, 15);

                driverMarker.current = window.L.marker(driverPos, { icon: ambulanceIcon }).addTo(mapInstance.current);
                patientMarker.current = window.L.marker(dispatchInfo.patientPos, { icon: patientIcon }).addTo(mapInstance.current);

                // Static Route Line
                routeLine.current = window.L.polyline([driverPos, dispatchInfo.patientPos], {
                    color: '#0D47A1', weight: 4, opacity: 0.8, dashArray: '8, 8'
                }).addTo(mapInstance.current);
            });

            // Tracking Interval Logic
            watchId.current = navigator.geolocation.watchPosition((pos) => {
                const newPos = [pos.coords.latitude, pos.coords.longitude];
                setLastUpdated(new Date().toLocaleTimeString());

                if (driverMarker.current) {
                    driverMarker.current.setLatLng(newPos);
                    if (routeLine.current) routeLine.current.setLatLngs([newPos, dispatchInfo.patientPos]);

                    // Auto-follow driver
                    if (tripStatus === 'started') mapInstance.current.panTo(newPos);
                }
            }, null, { enableHighAccuracy: true });
        }
    };

    const cleanupMap = () => {
        if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
        if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }
    };

    return (
        <div className="driver-dashboard-container">
            {/* Sidebar Navigation */}
            <aside className="driver-sidebar">
                <div className="sidebar-brand">
                    <img src={logoDark} alt="ERIS Logo" className="app-logo app-logo-dark" style={{ height: '36px' }} />
                    ERIS | DISPATCH
                </div>
                <div className="sidebar-nav">
                    <div className="sidebar-nav-item active">Navigation</div>
                    <div className="sidebar-nav-item">Duty Logs</div>
                    <div className="sidebar-nav-item">Radio Comm</div>
                </div>
                <div
                    className="sidebar-nav-item"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'var(--emergency-red-light)', fontSize: '13px', marginTop: 'auto' }}
                    onClick={() => navigate('/')}
                >
                    System Logout
                </div>
            </aside>

            {/* Main Map Content */}
            <main className="driver-main">
                <div id="map"></div>
                <div className="map-overlay-badge">
                    <span className="live-dot"></span>
                    DISPATCH ACTIVE | STATUS: {tripStatus.toUpperCase()}
                </div>
            </main>

            {/* Side Status Panel */}
            <aside className="tracking-panel">
                <div className="panel-header">
                    <h2>TRIP CONTROL PANEL</h2>
                    <p style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>ID: {dispatchInfo.requestId}</p>
                </div>

                <div className="patient-info-card" style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--emergency-red)', fontWeight: '900', marginBottom: '8px', letterSpacing: '0.05em' }}>EMERGENCY | CRITICAL</div>
                    <h3 style={{ textTransform: 'uppercase', marginBottom: '4px', color: '#f8fafc', fontSize: '20px' }}>{dispatchInfo.patientName}</h3>
                    <div style={{ fontSize: '14px', color: '#cbd5e1' }}>{dispatchInfo.emergencyType}</div>
                    <div style={{ marginTop: '16px', fontSize: '14px', color: '#94a3b8', lineHeight: 1.5 }}>
                        <b style={{ color: '#cbd5e1' }}>PICKUP:</b><br />{dispatchInfo.pickupAddress}
                    </div>
                </div>

                <div className="hospital-badge">
                    <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.05em', color: 'rgba(147, 197, 253, 0.7)' }}>DESTINATION HOSPITAL</div>
                    <div style={{ fontWeight: '700', marginTop: '6px', fontSize: '16px' }}>{dispatchInfo.hospitalName}</div>
                </div>

                <div style={{ padding: '0 24px', fontSize: '12px', color: '#64748b', marginTop: 'auto', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px' }}>SYSTEM STATUS</div>
                    <div style={{ fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success-green)' }}></span> GPS SYNC: OK
                    </div>
                    <div style={{ fontFamily: 'monospace', opacity: 0.8 }}>UPDATED: {lastUpdated}</div>
                </div>

                <div className="trip-buttons-container">
                    <button
                        className="unified-btn btn-start"
                        disabled={tripStatus !== 'idle'}
                        onClick={() => setTripStatus('started')}
                    >
                        START TRIP
                    </button>
                    <button
                        className="unified-btn btn-arrive"
                        disabled={tripStatus !== 'started'}
                        onClick={() => setTripStatus('arrived')}
                    >
                        ARRIVED AT PICKUP
                    </button>
                    <button
                        className="unified-btn btn-complete"
                        disabled={tripStatus !== 'arrived'}
                        onClick={() => {
                            setTripStatus('completed');
                            alert('Dispatch completed and logged.');
                            navigate('/');
                        }}
                    >
                        COMPLETE DISPATCH
                    </button>
                </div>
            </aside>
        </div>
    );
}

export default DriverDashboard;
