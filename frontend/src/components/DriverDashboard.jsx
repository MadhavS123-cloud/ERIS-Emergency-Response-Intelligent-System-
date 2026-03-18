import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useEris } from '../context/ErisContext';
import './DriverDashboard.css';

const statusMeta = {
    incoming: {
        label: 'Awaiting acceptance',
        badge: 'NEW CALL',
        destinationLabel: 'Pickup location',
    },
    assigned: {
        label: 'Assigned by hospital',
        badge: 'READY',
        destinationLabel: 'Pickup location',
    },
    en_route: {
        label: 'En route to patient',
        badge: 'RESPONDING',
        destinationLabel: 'Pickup location',
    },
    arrived: {
        label: 'Ambulance at pickup',
        badge: 'ON SCENE',
        destinationLabel: 'Prepare transport',
    },
    transporting: {
        label: 'Transporting to hospital',
        badge: 'TRANSPORT',
        destinationLabel: 'Receiving hospital',
    },
    completed: {
        label: 'Case closed',
        badge: 'COMPLETE',
        destinationLabel: 'Handover finished',
    },
};

function DriverDashboard() {
    const navigate = useNavigate();
    const { activeDispatch, dispatches, updateDispatchStatus, selectDispatch, resetDemoState } = useEris();
    const [activeTab, setActiveTab] = useState('navigation');
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const mapInstance = useRef(null);
    const driverMarker = useRef(null);
    const patientMarker = useRef(null);
    const hospitalMarker = useRef(null);
    const routeLine = useRef(null);
    const watchId = useRef(null);

    const dispatchInfo = activeDispatch;
    const currentStatus = dispatchInfo ? statusMeta[dispatchInfo.status] || statusMeta.incoming : statusMeta.incoming;
    const lastUpdated = dispatchInfo?.updatedAt || '--:--:--';

    useEffect(() => {
        if (activeTab !== 'navigation' || !dispatchInfo) {
            cleanupMap();
            return undefined;
        }

        initMap();
        return () => cleanupMap();
    }, [activeTab, dispatchInfo?.id, dispatchInfo?.status]);

    const getDestinationPosition = () => {
        if (!dispatchInfo) {
            return null;
        }

        if (dispatchInfo.status === 'transporting' || dispatchInfo.status === 'completed') {
            return dispatchInfo.hospitalPosition;
        }

        return dispatchInfo.patientPosition;
    };

    const renderRoute = (driverPosition) => {
        if (!window.L || !mapInstance.current || !dispatchInfo) {
            return;
        }

        const destination = getDestinationPosition();
        if (!destination) {
            return;
        }

        if (!driverMarker.current) {
            const ambulanceIcon = window.L.divIcon({
                className: 'ambulance-icon',
                html: `
                    <div style="background: white; border: 3px solid #0D47A1; padding: 4px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#0D47A1" stroke="#0D47A1" stroke-width="1.5"><path d="M10 17h.01"/><path d="M14 17h.01"/><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z"/><path d="M6 13V8l4-4h4l4 4v5"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            const patientIcon = window.L.divIcon({
                className: 'patient-icon',
                html: `
                    <div style="background: white; border: 3px solid #C62828; padding: 4px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#C62828" stroke="#C62828" stroke-width="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            const hospitalIcon = window.L.divIcon({
                className: 'hospital-icon',
                html: `
                    <div style="background: white; border: 3px solid #10b981; padding: 4px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#10b981" stroke="#10b981" stroke-width="1.5"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/><path d="M13 9v.01"/><path d="M13 12v.01"/><path d="M13 15v.01"/><path d="M17 15v.01"/><path d="M17 18v.01"/></svg>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            driverMarker.current = window.L.marker(driverPosition, { icon: ambulanceIcon }).addTo(mapInstance.current);
            patientMarker.current = window.L.marker(dispatchInfo.patientPosition, { icon: patientIcon })
                .addTo(mapInstance.current)
                .bindPopup(`<strong>${dispatchInfo.patientName}</strong><br />${dispatchInfo.pickupAddress}`);
            hospitalMarker.current = window.L.marker(dispatchInfo.hospitalPosition, { icon: hospitalIcon })
                .addTo(mapInstance.current)
                .bindPopup(`<strong>${dispatchInfo.hospitalName}</strong>`);
        } else {
            driverMarker.current.setLatLng(driverPosition);
            patientMarker.current?.setLatLng(dispatchInfo.patientPosition);
            hospitalMarker.current?.setLatLng(dispatchInfo.hospitalPosition);
        }

        if (!routeLine.current) {
            routeLine.current = window.L.polyline([driverPosition, destination], {
                color: '#0D47A1',
                weight: 4,
                opacity: 0.8,
                dashArray: '8, 8'
            }).addTo(mapInstance.current);
        } else {
            routeLine.current.setLatLngs([driverPosition, destination]);
        }

        mapInstance.current.fitBounds([driverPosition, dispatchInfo.patientPosition, dispatchInfo.hospitalPosition], {
            padding: [40, 40]
        });
    };

    const initMap = () => {
        if (!window.L || !dispatchInfo) {
            return;
        }

        cleanupMap();

        mapInstance.current = window.L.map('map', { zoomControl: false }).setView(dispatchInfo.patientPosition, 13);
        window.L.control.zoom({ position: 'topright' }).addTo(mapInstance.current);

        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO'
        }).addTo(mapInstance.current);

        const fallbackDriverPosition = [12.9684, 77.6021];

        const updateDriverLocation = (position) => {
            const driverPosition = [position.coords.latitude, position.coords.longitude];
            renderRoute(driverPosition);

            if (dispatchInfo.status === 'en_route' || dispatchInfo.status === 'transporting') {
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

    const handleStatusAdvance = (nextStatus) => {
        if (!dispatchInfo) {
            return;
        }

        const statusMessages = {
            en_route: 'Driver acknowledged the case and is en route to the patient.',
            arrived: 'EMS unit has arrived at the pickup point.',
            transporting: 'Patient loaded. Ambulance is moving to the receiving hospital.',
            completed: 'Hospital handover completed and dispatch closed.',
        };

        updateDispatchStatus(dispatchInfo.id, nextStatus, statusMessages[nextStatus], 'driver');
    };

    return (
        <div className="driver-dashboard-container">
            <aside className="driver-sidebar">
                <div className="sidebar-brand">
                    <img src="/logo192.png" alt="ERIS Logo" className="app-logo" style={{ height: '36px' }} />
                    ERIS | DISPATCH
                </div>

                <div className="sidebar-nav">
                    <div
                        className={`sidebar-nav-item ${activeTab === 'navigation' ? 'active' : ''}`}
                        onClick={() => setActiveTab('navigation')}
                    >
                        Navigation
                    </div>
                    <div
                        className={`sidebar-nav-item ${activeTab === 'logs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        Duty Logs
                    </div>
                    <div
                        className={`sidebar-nav-item ${activeTab === 'radio' ? 'active' : ''}`}
                        onClick={() => setActiveTab('radio')}
                    >
                        Radio Comm
                    </div>
                </div>

                <div className="driver-sidebar-queue">
                    <div className="driver-sidebar-label">Active Queue</div>
                    {dispatches.slice(0, 4).map((dispatch) => (
                        <button
                            key={dispatch.id}
                            type="button"
                            className={`dispatch-queue-card ${dispatch.id === dispatchInfo?.id ? 'selected' : ''}`}
                            onClick={() => {
                                selectDispatch(dispatch.id);
                                setActiveTab('navigation');
                            }}
                        >
                            <div className="dispatch-queue-row">
                                <strong>{dispatch.requestId}</strong>
                                <span>{dispatch.eta}</span>
                            </div>
                            <div className="dispatch-queue-name">{dispatch.patientName}</div>
                            <div className="dispatch-queue-row muted">
                                <span>{dispatch.priority}</span>
                                <span>{(statusMeta[dispatch.status] || statusMeta.incoming).badge}</span>
                            </div>
                        </button>
                    ))}
                </div>

                <button type="button" className="driver-secondary-action" onClick={resetDemoState}>
                    Reset Demo State
                </button>

                <div
                    className="sidebar-nav-item"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'var(--emergency-red-light)', fontSize: '13px' }}
                    onClick={() => navigate('/')}
                >
                    System Logout
                </div>
            </aside>

            <main className="driver-main">
                {activeTab === 'navigation' ? (
                    <>
                        <div id="map"></div>
                        <div className="map-overlay-badge">
                            <span className="live-dot"></span>
                            DISPATCH ACTIVE | STATUS: {currentStatus.badge}
                        </div>
                    </>
                ) : (
                    <div className="driver-alt-view">
                        {activeTab === 'logs' ? (
                            <>
                                <h2>Duty Timeline</h2>
                                <p>Every status update for the selected incident is recorded here for shift continuity.</p>
                                <div className="driver-log-list">
                                    {dispatchInfo?.logs?.slice().reverse().map((log) => (
                                        <div key={log.id} className="driver-log-item">
                                            <div className={`driver-log-type ${log.type}`}>{log.type}</div>
                                            <div>
                                                <strong>{log.message}</strong>
                                                <div className="driver-log-time">{log.timestamp}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <h2>Radio Communication Feed</h2>
                                <p>Use this panel to track patient, hospital, and dispatch coordination at a glance.</p>
                                <div className="driver-log-list">
                                    {dispatchInfo?.logs?.slice().reverse().map((log) => (
                                        <div key={log.id} className="driver-log-item radio-feed-item">
                                            <div className={`driver-log-type ${log.type}`}>{log.type}</div>
                                            <div>
                                                <strong>{log.message}</strong>
                                                <div className="driver-log-time">{dispatchInfo.requestId} | {log.timestamp}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </main>

            <aside className={`tracking-panel ${isPanelOpen ? 'mobile-open' : ''}`}>
                <div className="mobile-panel-handle" onClick={() => setIsPanelOpen(!isPanelOpen)}>
                    <div className="handle-bar"></div>
                </div>

                <div className="panel-header">
                    <h2>TRIP CONTROL PANEL</h2>
                    <p style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        ID: {dispatchInfo?.requestId || 'NO-ACTIVE-DISPATCH'}
                    </p>
                </div>

                {dispatchInfo ? (
                    <>
                        <div className="patient-info-card" style={{ marginBottom: '8px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--emergency-red)', fontWeight: '900', marginBottom: '8px', letterSpacing: '0.05em' }}>
                                {dispatchInfo.priority} | {currentStatus.badge}
                            </div>
                            <h3 style={{ textTransform: 'uppercase', marginBottom: '4px', color: '#f8fafc', fontSize: '20px' }}>
                                {dispatchInfo.patientName}
                            </h3>
                            <div style={{ fontSize: '14px', color: '#cbd5e1' }}>{dispatchInfo.emergencyType}</div>
                            <div style={{ marginTop: '16px', fontSize: '14px', color: '#94a3b8', lineHeight: 1.5 }}>
                                <b style={{ color: '#cbd5e1' }}>PICKUP:</b><br />{dispatchInfo.pickupAddress}
                            </div>
                            {dispatchInfo.medicalNotes ? (
                                <div className="driver-medical-note">
                                    <div className="driver-section-title">Medical notes</div>
                                    <div>{dispatchInfo.medicalNotes}</div>
                                </div>
                            ) : null}
                        </div>

                        <div className="hospital-badge">
                            <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.05em', color: 'rgba(147, 197, 253, 0.7)' }}>
                                {currentStatus.destinationLabel}
                            </div>
                            <div style={{ fontWeight: '700', marginTop: '6px', fontSize: '16px' }}>
                                {dispatchInfo.status === 'transporting' || dispatchInfo.status === 'completed'
                                    ? dispatchInfo.hospitalName
                                    : dispatchInfo.pickupAddress}
                            </div>
                        </div>

                        <div className="driver-panel-stats">
                            <div className="driver-stat-card">
                                <span>Ambulance</span>
                                <strong>{dispatchInfo.ambulanceId}</strong>
                            </div>
                            <div className="driver-stat-card">
                                <span>Contact</span>
                                <strong>{dispatchInfo.contactNumber}</strong>
                            </div>
                        </div>

                        <div style={{ padding: '0 24px', fontSize: '12px', color: '#64748b', marginTop: 'auto', marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px' }}>SYSTEM STATUS</div>
                            <div style={{ fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success-green)' }}></span>
                                GPS SYNC: OK
                            </div>
                            <div style={{ fontFamily: 'monospace', opacity: 0.8 }}>UPDATED: {lastUpdated}</div>
                            <div style={{ fontFamily: 'monospace', opacity: 0.8 }}>STATUS: {currentStatus.label.toUpperCase()}</div>
                        </div>

                        <div className="trip-buttons-container">
                            <button
                                className="unified-btn btn-start"
                                disabled={!['incoming', 'assigned'].includes(dispatchInfo.status)}
                                onClick={() => handleStatusAdvance('en_route')}
                            >
                                ACCEPT DISPATCH
                            </button>
                            <button
                                className="unified-btn btn-arrive"
                                disabled={dispatchInfo.status !== 'en_route'}
                                onClick={() => handleStatusAdvance('arrived')}
                            >
                                ARRIVED AT PICKUP
                            </button>
                            <button
                                className="unified-btn btn-transport"
                                disabled={dispatchInfo.status !== 'arrived'}
                                onClick={() => handleStatusAdvance('transporting')}
                            >
                                TRANSPORT PATIENT
                            </button>
                            <button
                                className="unified-btn btn-complete"
                                disabled={dispatchInfo.status !== 'transporting'}
                                onClick={() => handleStatusAdvance('completed')}
                            >
                                COMPLETE HANDOVER
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="driver-empty-state">
                        No active dispatch is selected. Create a new emergency request from the patient portal to begin.
                    </div>
                )}
            </aside>
        </div>
    );
}

export default DriverDashboard;
