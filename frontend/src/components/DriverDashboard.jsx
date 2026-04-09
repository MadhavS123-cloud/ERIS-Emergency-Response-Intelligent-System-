import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEris } from '../context/ErisContext';
import { addTomTomLayers } from '../config/tomtom';
import './DriverDashboard.css';

const stepConfig = {
    incoming:   { label: 'WAIT FOR DISPATCH',  color: 'btn-blue',   next: null,         stepNum: 0, totalSteps: 4, stepTitle: 'Awaiting hospital assignment' },
    assigned:   { label: 'START NAVIGATION →',  color: 'btn-blue',   next: 'en_route',   stepNum: 1, totalSteps: 4, stepTitle: 'GO TO PICKUP' },
    en_route:   { label: 'ARRIVED AT PICKUP →', color: 'btn-blue',   next: 'arrived',    stepNum: 2, totalSteps: 4, stepTitle: 'GO TO PICKUP' },
    arrived:    { label: 'START TRANSIT →',     color: 'btn-orange', next: 'in_transit', stepNum: 3, totalSteps: 4, stepTitle: 'PATIENT BOARDING' },
    in_transit: { label: 'COMPLETE HANDOVER →', color: 'btn-green',  next: 'completed',  stepNum: 4, totalSteps: 4, stepTitle: 'HEADING TO HOSPITAL' },
    completed:  { label: 'CASE CLOSED',         color: 'btn-blue',   next: null,         stepNum: 4, totalSteps: 4, stepTitle: 'Standby' },
};

function DriverDashboard() {
    const navigate = useNavigate();
    const { activeDispatch, dispatches, updateDispatchStatus, selectDispatch, logout } = useEris();
    const [showDetails, setShowDetails] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);

    const mapInstance = useRef(null);
    const driverMarker = useRef(null);
    const patientMarker = useRef(null);
    const hospitalMarker = useRef(null);
    const routeLine = useRef(null);
    const simInterval = useRef(null);
    const currentPos = useRef([12.9684, 77.6021]);

    const dispatchInfo = activeDispatch;

    const getDestinationPosition = useCallback(() => {
        if (!dispatchInfo) return null;
        if (dispatchInfo.status === 'in_transit' || dispatchInfo.status === 'completed') {
            return dispatchInfo.hospitalPosition;
        }
        return dispatchInfo.patientPosition;
    }, [dispatchInfo]);

    const renderRoute = useCallback((pos) => {
        if (!window.L || !mapInstance.current || !dispatchInfo) return;
        const destination = getDestinationPosition();
        if (!destination) return;

        if (!driverMarker.current) {
            const ambulanceIcon = window.L.divIcon({
                className: 'dd-ambulance-icon',
                html: `<div><svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5"><path d="M10 17h.01"/><path d="M14 17h.01"/><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z"/><path d="M6 13V8l4-4h4l4 4v5"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg></div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });
            const patientIcon = window.L.divIcon({
                className: 'dd-patient-icon',
                html: `<div class="dd-pulse-ring"></div><div class="dd-pulse-dot"></div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });
            const hospitalIcon = window.L.divIcon({
                className: 'dd-hospital-icon',
                html: `<div><svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></svg></div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            driverMarker.current = window.L.marker(pos, { icon: ambulanceIcon }).addTo(mapInstance.current);
            patientMarker.current = window.L.marker(dispatchInfo.patientPosition, { icon: patientIcon }).addTo(mapInstance.current);
            hospitalMarker.current = window.L.marker(dispatchInfo.hospitalPosition, { icon: hospitalIcon }).addTo(mapInstance.current);
        } else {
            driverMarker.current.setLatLng(pos);
        }

        if (!routeLine.current) {
            routeLine.current = window.L.polyline([pos, destination], {
                color: '#3b82f6',
                weight: 5,
                opacity: 0.85,
                dashArray: '10 6',
            }).addTo(mapInstance.current);
        } else {
            routeLine.current.setLatLngs([pos, destination]);
        }

        mapInstance.current.fitBounds(
            [pos, dispatchInfo.patientPosition, dispatchInfo.hospitalPosition],
            { padding: [80, 80], maxZoom: 15 }
        );
    }, [dispatchInfo, getDestinationPosition]);

    const cleanupMap = useCallback(() => {
        if (simInterval.current) {
            clearInterval(simInterval.current);
            simInterval.current = null;
        }
        if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }
        driverMarker.current = null;
        patientMarker.current = null;
        hospitalMarker.current = null;
        routeLine.current = null;
    }, []);

    const initMap = useCallback(() => {
        if (!window.L || !dispatchInfo) return;
        cleanupMap();

        mapInstance.current = window.L.map('driver-map', {
            zoomControl: false,
            attributionControl: false,
        }).setView(dispatchInfo.patientPosition, 14);

        addTomTomLayers(mapInstance.current, 'night', true, false);

        // Try to get real location first, fall back to dummy
        const startFromLocation = (lat, lng) => {
            currentPos.current = [lat, lng];
            renderRoute(currentPos.current);
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => startFromLocation(pos.coords.latitude, pos.coords.longitude),
                () => startFromLocation(12.9684, 77.6021),
                { enableHighAccuracy: true, timeout: 3000 }
            );
        } else {
            startFromLocation(12.9684, 77.6021);
        }

        // Simulation: move ambulance marker toward destination
        if (dispatchInfo.status === 'en_route' || dispatchInfo.status === 'in_transit') {
            simInterval.current = setInterval(() => {
                const dest = getDestinationPosition();
                if (!dest || !mapInstance.current) return;

                const latDiff = dest[0] - currentPos.current[0];
                const lngDiff = dest[1] - currentPos.current[1];
                currentPos.current = [
                    currentPos.current[0] + latDiff * 0.04,
                    currentPos.current[1] + lngDiff * 0.04,
                ];

                if (driverMarker.current) {
                    driverMarker.current.setLatLng(currentPos.current);
                }
                if (routeLine.current) {
                    const dest2 = getDestinationPosition();
                    if (dest2) routeLine.current.setLatLngs([currentPos.current, dest2]);
                }
                mapInstance.current.panTo(currentPos.current);
            }, 1200);
        }
    }, [dispatchInfo, cleanupMap, renderRoute, getDestinationPosition]);

    useEffect(() => {
        if (!dispatchInfo || dispatchInfo.status === 'completed') {
            cleanupMap();
            return undefined;
        }
        initMap();
        return () => cleanupMap();
    }, [dispatchInfo?.id, dispatchInfo?.status]);

    const handleAdvance = useCallback(async (nextStatus) => {
        if (!dispatchInfo) return;
        const msg = {
            en_route: 'Unit moving to pickup.',
            arrived: 'Unit arrived at pickup.',
            in_transit: 'Unit heading to hospital with patient.',
            completed: 'Handover complete.',
        };
        const result = await updateDispatchStatus(dispatchInfo.id, nextStatus, msg[nextStatus]);
        if (!result.ok) {
            alert(`⚠️ Update Failed: ${result.message}`);
        }
    }, [dispatchInfo, updateDispatchStatus]);

    const handleMarkFake = useCallback(() => {
        if (!dispatchInfo || !window.confirm('Mark this as a fake request? It will cancel the case.')) return;
        updateDispatchStatus(dispatchInfo.id, 'completed', 'Marked as False Request by Driver', { driverFeedback: 'False Request' });
    }, [dispatchInfo, updateDispatchStatus]);

    // =================== EMPTY STATE ===================
    if (!dispatchInfo || dispatchInfo.status === 'completed') {
        return (
            <div className="dd-layout">
                <div className="dd-empty-state">
                    <div className="dd-empty-pulse"></div>
                    <h2>Searching for Emergencies...</h2>
                    <p>Stay in your current zone. We'll notify you when a dispatch is assigned.</p>
                    <div className="dd-empty-queue">
                        <span className="dd-label">AVAILABLE DISPATCHES</span>
                        {dispatches.filter(d => d.status !== 'completed').slice(0, 5).map(d => (
                            <button key={d.id} className="dd-queue-btn" onClick={() => selectDispatch(d.id)}>
                                <div className="dd-queue-id">{d.requestId}</div>
                                <div className="dd-queue-meta">{d.patientName} · {d.emergencyType}</div>
                            </button>
                        ))}
                        {dispatches.filter(d => d.status !== 'completed').length === 0 && (
                            <p className="dd-queue-empty">No pending dispatches.</p>
                        )}
                    </div>
                    <button className="dd-exit-btn" onClick={() => navigate('/')}>Exit Driver Portal</button>
                </div>
            </div>
        );
    }

    const currentStep = stepConfig[dispatchInfo.status] || stepConfig.incoming;
    const isGoingToHospital = dispatchInfo.status === 'in_transit' || dispatchInfo.status === 'completed';
    const destLabel = isGoingToHospital ? 'HOSPITAL' : 'PICKUP';
    const destAddress = isGoingToHospital ? dispatchInfo.hospitalName : dispatchInfo.pickupAddress;

    return (
        <div className="dd-layout">
            {/* ====== MAP ====== */}
            <div className="dd-map-area">
                <div id="driver-map"></div>
            </div>

            {/* ====== SIDEBAR ====== */}
            {sidebarOpen && <div className="dd-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
            <div className={`dd-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <button className="dd-sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
                <span className="dd-label" style={{ marginTop: 40 }}>ACTIVE QUEUE</span>
                {dispatches.filter(d => d.status !== 'completed').map(d => (
                    <button
                        key={d.id}
                        className={`dd-queue-btn ${d.id === dispatchInfo.id ? 'active' : ''}`}
                        onClick={() => { selectDispatch(d.id); setSidebarOpen(false); }}
                    >
                        <div className="dd-queue-id">{d.requestId}</div>
                        <div className="dd-queue-meta">{d.priority} · {d.eta}</div>
                    </button>
                ))}
                <button className="dd-queue-btn dd-logout-btn" onClick={logout}>System Logout</button>
            </div>

            {/* ====== NOTES MODAL ====== */}
            {notesOpen && (
                <div className="dd-notes-overlay" onClick={() => setNotesOpen(false)}>
                    <div className="dd-notes-modal" onClick={e => e.stopPropagation()}>
                        <div className="dd-notes-header">
                            <h3>Case Details</h3>
                            <button onClick={() => setNotesOpen(false)}>✕</button>
                        </div>
                        <div className="dd-notes-body">
                            <div className="dd-notes-field"><span>Patient</span><strong>{dispatchInfo.patientName}</strong></div>
                            <div className="dd-notes-field"><span>Contact</span><strong>{dispatchInfo.contactNumber}</strong></div>
                            <div className="dd-notes-field"><span>Emergency</span><strong>{dispatchInfo.emergencyType}</strong></div>
                            <div className="dd-notes-field"><span>Address</span><strong>{dispatchInfo.pickupAddress}</strong></div>
                            <div className="dd-notes-field"><span>Hospital</span><strong>{dispatchInfo.hospitalName}</strong></div>
                            {dispatchInfo.medicalNotes && (
                                <div className="dd-notes-field"><span>Notes</span><strong>{dispatchInfo.medicalNotes}</strong></div>
                            )}
                        </div>
                        <button className="dd-fake-btn" onClick={handleMarkFake}>⚠️ Mark as False Request</button>
                    </div>
                </div>
            )}

            {/* ====== MAP OVERLAYS ====== */}
            <button className="dd-menu-btn" onClick={() => setSidebarOpen(true)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>

            <div className="dd-top-pill">
                <span className="dd-pill-icon">🚨</span>
                <span className="dd-pill-title">EMERGENCY: {dispatchInfo.emergencyType}</span>
                <span className="dd-pill-sep">|</span>
                <span className="dd-pill-priority">{dispatchInfo.priority}</span>
            </div>

            {dispatchInfo.status !== 'incoming' && dispatchInfo.status !== 'completed' && (
                <div className="dd-eta-float">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    {dispatchInfo.eta}
                </div>
            )}

            <div className="dd-map-fabs">
                <a href={`tel:${dispatchInfo.contactNumber}`} className="dd-fab" title="Call Patient">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </a>
                <a href="tel:102" className="dd-fab" title="Call Dispatch">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
                </a>
            </div>

            {/* ====== BOTTOM PANEL ====== */}
            <div className="dd-bottom-panel">
                {/* Step & Progress */}
                <div className="dd-step-row">
                    <span className="dd-step-title">STEP {currentStep.stepNum} OF {currentStep.totalSteps} | {currentStep.stepTitle}</span>
                    <button className="dd-details-toggle" onClick={() => setShowDetails(!showDetails)}>
                        {showDetails ? 'Hide' : 'Details'} {showDetails ? '▲' : '▼'}
                    </button>
                </div>

                <div className="dd-progress-bar">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`dd-progress-seg ${currentStep.stepNum >= i ? 'filled' : ''}`} />
                    ))}
                </div>

                {/* Destination */}
                <div className="dd-dest-block">
                    <div className="dd-dest-line">Destination: <strong>{destLabel}</strong></div>
                    <div className="dd-dest-line">Location: <strong>{destAddress}</strong></div>
                </div>

                {/* Inline Details (replaces sheet drawer) */}
                {showDetails && (
                    <div className="dd-details-panel">
                        <div className="dd-detail-row">
                            <span className="dd-detail-label">Patient</span>
                            <span className="dd-detail-value">{dispatchInfo.patientName}</span>
                        </div>
                        <div className="dd-detail-row">
                            <span className="dd-detail-label">Contact</span>
                            <span className="dd-detail-value">{dispatchInfo.contactNumber}</span>
                        </div>
                        <div className="dd-detail-row">
                            <span className="dd-detail-label">Type</span>
                            <span className="dd-detail-value">{dispatchInfo.emergencyType}</span>
                        </div>
                        {dispatchInfo.medicalNotes && (
                            <div className="dd-detail-row">
                                <span className="dd-detail-label">Notes</span>
                                <span className="dd-detail-value">{dispatchInfo.medicalNotes}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="dd-actions">
                    <button
                        className={`dd-primary-btn ${currentStep.color}`}
                        onClick={() => { if (currentStep.next) handleAdvance(currentStep.next); }}
                        disabled={!currentStep.next}
                    >
                        {currentStep.label}
                    </button>
                    <a href={`tel:${dispatchInfo.contactNumber}`} className="dd-action-square">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        <span>Call</span>
                    </a>
                    <button className="dd-action-square" onClick={() => setNotesOpen(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        <span>Notes</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DriverDashboard;
