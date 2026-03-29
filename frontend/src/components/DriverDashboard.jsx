import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEris } from '../context/ErisContext';
import './DriverDashboard.css';

const stepConfig = {
    incoming: { label: 'WAIT FOR DISPATCH', color: 'btn-blue', next: null, stepLabel: 'Awaiting hospital assignment' },
    assigned: { label: 'START NAVIGATION', color: 'btn-blue', next: 'en_route', stepLabel: 'Step 1 of 2: Ambulance assigned' },
    en_route: { label: 'COMPLETE HANDOVER', color: 'btn-green', next: 'completed', stepLabel: 'Step 2 of 2: En route to patient' },
    completed: { label: 'CASE CLOSED', color: 'btn-blue', next: null, stepLabel: 'Standby' },
};

function DriverDashboard() {
    const navigate = useNavigate();
    const { activeDispatch, dispatches, updateDispatchStatus, selectDispatch, logout } = useEris();
    const [sheetExpanded, setSheetExpanded] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const mapInstance = useRef(null);
    const driverMarker = useRef(null);
    const patientMarker = useRef(null);
    const hospitalMarker = useRef(null);
    const routeLine = useRef(null);
    const watchId = useRef(null);

    const dispatchInfo = activeDispatch;

    useEffect(() => {
        if (!dispatchInfo || dispatchInfo.status === 'completed') {
            cleanupMap();
            return undefined;
        }

        initMap();
        return () => cleanupMap();
    }, [dispatchInfo?.id, dispatchInfo?.status]);

    const getDestinationPosition = () => {
        if (!dispatchInfo) return null;
        if (dispatchInfo.status === 'completed') {
            return dispatchInfo.hospitalPosition;
        }
        return dispatchInfo.patientPosition;
    };

    const renderRoute = (driverPosition) => {
        if (!window.L || !mapInstance.current || !dispatchInfo) return;

        const destination = getDestinationPosition();
        if (!destination) return;

        if (!driverMarker.current) {
            const ambulanceIcon = window.L.divIcon({
                className: 'uber-ambulance-icon',
                html: `<div><svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5"><path d="M10 17h.01"/><path d="M14 17h.01"/><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z"/><path d="M6 13V8l4-4h4l4 4v5"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg></div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            const patientIcon = window.L.divIcon({
                className: 'uber-patient-icon',
                html: `<div></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const hospitalIcon = window.L.divIcon({
                className: 'uber-hospital-icon',
                html: `<div><svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/><path d="M13 9v.01"/><path d="M13 12v.01"/><path d="M13 15v.01"/><path d="M17 15v.01"/><path d="M17 18v.01"/></svg></div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            driverMarker.current = window.L.marker(driverPosition, { icon: ambulanceIcon }).addTo(mapInstance.current);
            patientMarker.current = window.L.marker(dispatchInfo.patientPosition, { icon: patientIcon }).addTo(mapInstance.current);
            hospitalMarker.current = window.L.marker(dispatchInfo.hospitalPosition, { icon: hospitalIcon }).addTo(mapInstance.current);
        } else {
            driverMarker.current.setLatLng(driverPosition);
            patientMarker.current?.setLatLng(dispatchInfo.patientPosition);
            hospitalMarker.current?.setLatLng(dispatchInfo.hospitalPosition);
        }

        if (!routeLine.current) {
            routeLine.current = window.L.polyline([driverPosition, destination], {
                color: '#2563eb', // Thick Uber-style line
                weight: 6,
                opacity: 0.9,
            }).addTo(mapInstance.current);
        } else {
            routeLine.current.setLatLngs([driverPosition, destination]);
        }

        mapInstance.current.fitBounds([driverPosition, dispatchInfo.patientPosition, dispatchInfo.hospitalPosition], {
            padding: [60, 60]
        });
    };

    const initMap = () => {
        if (!window.L || !dispatchInfo) return;

        cleanupMap();

        mapInstance.current = window.L.map('driver-map', { zoomControl: false, attributionControl: false }).setView(dispatchInfo.patientPosition, 13);

        // Carto light map for clean navigation look
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(mapInstance.current);

        const fallbackDriverPosition = [12.9684, 77.6021];

        const updateDriverLocation = (position) => {
            const driverPosition = [position.coords.latitude, position.coords.longitude];
            renderRoute(driverPosition);

            if (dispatchInfo.status === 'en_route') {
                mapInstance.current.panTo(driverPosition);
            }
        };

        const useFallbackLocation = () => renderRoute(fallbackDriverPosition);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(updateDriverLocation, useFallbackLocation, { enableHighAccuracy: true });
            watchId.current = navigator.geolocation.watchPosition(updateDriverLocation, useFallbackLocation, { enableHighAccuracy: true });
        } else {
            useFallbackLocation();
        }
    };

    const cleanupMap = () => {
        if (watchId.current) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
        if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }
        driverMarker.current = null;
        patientMarker.current = null;
        hospitalMarker.current = null;
        routeLine.current = null;
    };

    const handleAdvance = (nextStatus) => {
        if (!dispatchInfo) return;
        const msg = {
            en_route: 'Unit moving to pickup.',
            completed: 'Handover complete.',
        };
        updateDispatchStatus(dispatchInfo.id, nextStatus, msg[nextStatus]);
        setSheetExpanded(false);
    };

    if (!dispatchInfo || dispatchInfo.status === 'completed') {
        return (
            <div className="uber-driver-layout">
                <div style={{ padding: '60px 40px', background: '#1e293b', height: '100%', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Searching for Emergencies...</h2>
                    <p style={{ color: '#94a3b8', marginBottom: '40px' }}>Stay in your current zone.</p>

                    <div style={{ width: '100%', maxWidth: '400px' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 800, marginBottom: '16px', letterSpacing: '0.1em' }}>AVAILABLE DISPATCHES (DEMO)</div>
                        {dispatches.filter(d => d.status !== 'completed').slice(0, 3).map(d => (
                            <button key={d.id} className="queue-btn" onClick={() => selectDispatch(d.id)}>
                                <div style={{ fontWeight: 800, fontSize: '16px', color: 'white', marginBottom: '4px' }}>{d.requestId}</div>
                                <div style={{ color: '#94a3b8', fontSize: '14px' }}>{d.patientName} • {d.emergencyType}</div>
                            </button>
                        ))}
                    </div>

                    <button className="queue-btn" style={{ maxWidth: '400px', textAlign: 'center', marginTop: '40px' }} onClick={() => navigate('/')}>Exit Driver Portal</button>
                </div>
            </div>
        );
    }

    const currentStep = stepConfig[dispatchInfo.status] || stepConfig.incoming;

    return (
        <div className="uber-driver-layout">
            <div id="driver-map"></div>

            {/* Hidden Side Menu for Queue/Logout */}
            <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}>
                <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
                <div style={{ marginTop: '40px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 800, marginBottom: '16px', letterSpacing: '0.1em' }}>ACTIVE QUEUE</div>
                    {dispatches.filter(d => d.status !== 'completed').map(d => (
                        <button key={d.id} className="queue-btn" style={{ borderColor: d.id === dispatchInfo.id ? '#3b82f6' : '#475569' }} onClick={() => { selectDispatch(d.id); setSidebarOpen(false); }}>
                            <div style={{ fontWeight: 800, fontSize: '16px' }}>{d.requestId}</div>
                            <div style={{ color: '#94a3b8', fontSize: '14px' }}>{d.priority} • {d.eta}</div>
                        </button>
                    ))}
                    <button className="queue-btn" style={{ marginTop: 'auto', background: 'transparent', borderColor: '#ef4444', color: '#ef4444' }} onClick={logout}>System Logout</button>
                </div>
            </div>

            {/* Menu Toggle */}
            <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.5"><path d="M4 12h16M4 6h16M4 18h16" /></svg>
            </button>

            {/* Top Status Strip */}
            <div className="top-status-strip">
                <span className={`priority-badge priority-${dispatchInfo.priority.toLowerCase()}`}>
                    🚨 {dispatchInfo.priority}
                </span>
                <span className="eta-text">• {dispatchInfo.eta} Away •</span>
                <span className="emergency-tag">{dispatchInfo.emergencyType}</span>
            </div>

            {/* Navigation Hint */}
            {dispatchInfo.status === 'en_route' && (
                <div className="nav-hint-card">
                    <span className="nav-arrow">⬆️</span>
                    <div>
                        <div className="nav-instruction">Proceed to pickup</div>
                        <div className="nav-dist">Continue straight on route</div>
                    </div>
                </div>
            )}

            {/* Floating Actions */}
            <div className="floating-actions-right">
                <button className="fab" title="Call Patient">📞</button>
                <button className="fab" title="Call Hospital">🏥</button>
                <button className="fab" title="Recalculate Route" onClick={() => initMap()}>🔄</button>
            </div>

            {/* Bottom Action Sheet */}
            <div
                className="bottom-sheet"
                onClick={() => !sheetExpanded && setSheetExpanded(true)}
            >
                <div className="drag-handle" onClick={(e) => { e.stopPropagation(); setSheetExpanded(!sheetExpanded); }}></div>

                <div className="sheet-header">
                    <div>
                        <div className="dest-label">DESTINATION: PICKUP</div>
                        <div className="dest-address">
                            {dispatchInfo.pickupAddress}
                        </div>
                    </div>
                    <div className="sheet-eta-large">{dispatchInfo.eta}</div>
                </div>

                {sheetExpanded && (
                    <div className="sheet-extended">
                        <div className="info-row">
                            <span className="info-icon">👤</span>
                            <div>
                                <div className="info-bold">{dispatchInfo.patientName}</div>
                                <div className="info-sub">{dispatchInfo.contactNumber}</div>
                            </div>
                        </div>
                        <div className="info-row">
                            <span className="info-icon">⚠️</span>
                            <div>
                                <div className="info-bold">{dispatchInfo.emergencyType}</div>
                                {dispatchInfo.medicalNotes && (
                                    <div className="alert-item">
                                        ⚠️ {dispatchInfo.medicalNotes.length > 50 ? dispatchInfo.medicalNotes.substring(0, 50) + '...' : dispatchInfo.medicalNotes}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <button
                    className={`step-button ${currentStep.color}`}
                    onClick={(e) => { e.stopPropagation(); if (currentStep.next) handleAdvance(currentStep.next); }}
                    disabled={!currentStep.next}
                >
                    {currentStep.label}
                </button>
                <div className="step-progress">{currentStep.stepLabel}</div>
            </div>
        </div>
    );
}

export default DriverDashboard;
