import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEris } from '../context/ErisContext';
import authService from '../services/authService';
import { addTomTomLayers, fetchTomTomRoute } from '../config/tomtom';
import { socket } from '../socket';
import './HospitalDashboard.css';

const statusLabels = {
    incoming: 'Waiting for Ambulance',
    assigned: 'Ambulance Assigned',
    en_route: 'Ambulance En Route',
    completed: 'Closed',
};

function HospitalDashboard() {
    const {
        dispatches,
        activeDispatch,
        currentHospital,
        hospitalFleet,
        hospitalCapacity,
        assignDispatch,
        updateDispatchStatus,
        selectDispatch,
        updateHospitalCapacity,
        logout,
    } = useEris();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [capacityForm, setCapacityForm] = useState(hospitalCapacity);
    const [syncMessage, setSyncMessage] = useState('');
    const [assignmentSelections, setAssignmentSelections] = useState({});
    // Security panel state (ADMIN only)
    const [suspiciousRequests, setSuspiciousRequests] = useState([]);
    const [deviceList, setDeviceList] = useState([]);
    const [securityLoading, setSecurityLoading] = useState(false);

    // Tracking modal state
    const [trackingDispatch, setTrackingDispatch] = useState(null);
    const trackMapRef = useRef(null);
    const trackMapContainerRef = useRef(null);
    const trackAmbMarkerRef = useRef(null);
    const trackPatientMarkerRef = useRef(null);
    const trackRouteRef = useRef(null);
    const [liveCoords, setLiveCoords] = useState(null); // { lat, lng, updatedAt }
    const currentUser = authService.getUser();
    const isAdmin = currentUser?.role === 'ADMIN';
    const hospitalName = currentHospital?.name || `Hospital Account: ${currentUser?.hospitalId || 'Unlinked'}`;
    const hospitalId = currentHospital?.id || currentUser?.hospitalId || 'Unlinked';
    const availableFleet = hospitalFleet.filter((ambulance) => ambulance.isAvailable).length;
    const availableFleetOptions = hospitalFleet.filter((ambulance) => ambulance.isAvailable);

    const loadSecurityData = useCallback(async () => {
        if (!isAdmin) return;
        setSecurityLoading(true);
        try {
            const token = authService.getToken();
            const headers = { Authorization: `Bearer ${token}` };
            const [suspRes, devRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/admin/suspicious`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/admin/devices`, { headers })
            ]);
            const [suspData, devData] = await Promise.all([suspRes.json(), devRes.json()]);
            if (suspData.status === 'success') setSuspiciousRequests(suspData.data);
            if (devData.status === 'success') setDeviceList(devData.data);
        } catch (e) {
            console.error('Failed to load security data', e);
        } finally {
            setSecurityLoading(false);
        }
    }, [isAdmin]);

    const handleBlacklist = async (deviceId, blacklisted) => {
        try {
            const token = authService.getToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/admin/devices/${deviceId}/blacklist`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ blacklisted })
            });
            await loadSecurityData();
        } catch (e) {
            console.error('Blacklist action failed', e);
        }
    };

    useEffect(() => {
        if (activeTab === 'security') loadSecurityData();
    }, [activeTab, loadSecurityData]);

    // ── Tracking Modal: init map when modal opens ──
    useEffect(() => {
        if (!trackingDispatch || !window.L) return;

        // Wait one tick for the DOM to render the modal container
        const timer = setTimeout(() => {
            if (!trackMapContainerRef.current) return;

            // Destroy previous instance
            if (trackMapRef.current) {
                trackMapRef.current.remove();
                trackMapRef.current = null;
                trackAmbMarkerRef.current = null;
                trackPatientMarkerRef.current = null;
                trackRouteRef.current = null;
            }

            const patientPos = trackingDispatch.patientPosition;
            const ambPos = trackingDispatch.ambulancePosition;
            const center = ambPos || patientPos || [20, 78];

            trackMapRef.current = window.L.map(trackMapContainerRef.current, {
                zoomControl: true,
                attributionControl: false,
            }).setView(center, 14);

            addTomTomLayers(trackMapRef.current, 'night', true, false);
            setTimeout(() => trackMapRef.current?.invalidateSize(), 100);

            // Patient marker
            if (patientPos) {
                const patientIcon = window.L.divIcon({
                    className: '',
                    html: `<div style="position:relative;width:20px;height:20px;">
                        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:20px;height:20px;background:rgba(239,68,68,0.35);border-radius:50%;animation:track-modal-pulse 2s infinite;"></div>
                        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:10px;height:10px;background:#ef4444;border:2px solid white;border-radius:50%;"></div>
                    </div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                });
                trackPatientMarkerRef.current = window.L.marker(patientPos, { icon: patientIcon })
                    .addTo(trackMapRef.current)
                    .bindPopup(`<b>Patient</b><br/>${trackingDispatch.patientName}<br/>${trackingDispatch.emergencyType}`);
            }

            // Ambulance marker
            if (ambPos) {
                const ambIcon = window.L.divIcon({
                    className: '',
                    html: `<div style="background:white;border:3px solid #2563eb;border-radius:50%;padding:4px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#2563eb" stroke="#2563eb" stroke-width="1.5">
                            <path d="M10 17h.01"/><path d="M14 17h.01"/>
                            <path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z"/>
                            <path d="M6 13V8l4-4h4l4 4v5"/>
                        </svg>
                    </div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                });
                trackAmbMarkerRef.current = window.L.marker(ambPos, { icon: ambIcon })
                    .addTo(trackMapRef.current)
                    .bindPopup(`<b>${trackingDispatch.ambulanceId}</b><br/>Driver: ${trackingDispatch.driverName}`);

                // Fetch actual route line
                let routeOrigin = null;
                let routeDest = null;
                if (['incoming', 'assigned', 'en_route', 'arrived'].includes(trackingDispatch.status)) {
                    routeOrigin = currentHospital?.location?.coordinates || ambPos;
                    routeDest = patientPos;
                } else {
                    routeOrigin = patientPos;
                    routeDest = currentHospital?.location?.coordinates || ambPos;
                }

                if (routeOrigin && routeDest) {
                    fetchTomTomRoute(routeOrigin, routeDest).then(routeData => {
                        if (routeData?.points && trackMapRef.current) {
                            trackRouteRef.current = window.L.polyline(routeData.points, {
                                color: '#2563eb', weight: 4, opacity: 0.85
                            }).addTo(trackMapRef.current);
                        }
                    });
                } else if (patientPos) {
                    // Fallback straight line
                    trackRouteRef.current = window.L.polyline([ambPos, patientPos], {
                        color: '#2563eb', weight: 3, opacity: 0.8, dashArray: '8, 8'
                    }).addTo(trackMapRef.current);
                }

                setLiveCoords({ lat: ambPos[0], lng: ambPos[1], updatedAt: new Date() });
            } else {
                setLiveCoords(null);
            }

            // Fit bounds
            const points = [patientPos, ambPos].filter(Boolean);
            if (points.length > 1) {
                trackMapRef.current.fitBounds(points, { padding: [40, 40] });
            }
        }, 80);

        return () => clearTimeout(timer);
    }, [trackingDispatch?.id]); // re-init only when a different dispatch is opened

    // ── Tracking Modal: update ambulance marker in real-time via socket ──
    useEffect(() => {
        if (!trackingDispatch) return;

        const handleLocationUpdate = ({ ambulanceId, locationLat, locationLng }) => {
            if (ambulanceId !== trackingDispatch.ambulanceInternalId) return;

            const newPos = [locationLat, locationLng];
            setLiveCoords({ lat: locationLat, lng: locationLng, updatedAt: new Date() });

            if (!trackMapRef.current || !window.L) return;

            if (trackAmbMarkerRef.current) {
                trackAmbMarkerRef.current.setLatLng(newPos);
            }
        };

        socket.on('location_update', handleLocationUpdate);
        return () => socket.off('location_update', handleLocationUpdate);
    }, [trackingDispatch?.id, trackingDispatch?.ambulanceInternalId, trackingDispatch?.patientPosition]);

    // ── Tracking Modal: cleanup map on close ──
    const closeTrackingModal = useCallback(() => {
        if (trackMapRef.current) {
            trackMapRef.current.remove();
            trackMapRef.current = null;
            trackAmbMarkerRef.current = null;
            trackPatientMarkerRef.current = null;
            trackRouteRef.current = null;
        }
        setTrackingDispatch(null);
        setLiveCoords(null);
    }, []);
    
    // Tracking Map Logic
    const mapInstance = useRef(null);
    const markersRef = useRef({});
    const mapContainerRef = useRef(null);

    const initMap = useCallback(() => {
        if (!window.L || !mapContainerRef.current || mapInstance.current) return;

        // Center on the hospital's real location if available, else defer
        const center = currentHospital?.locationLat && currentHospital?.locationLng
            ? [currentHospital.locationLat, currentHospital.locationLng]
            : null;

        mapInstance.current = window.L.map(mapContainerRef.current, {
            zoomControl: true,
            attributionControl: false,
        }).setView(center || [20, 78], center ? 12 : 5); // India overview if no hospital location

        addTomTomLayers(mapInstance.current, 'night', true, false);

        // Force tile render after container is fully painted
        setTimeout(() => mapInstance.current?.invalidateSize(), 150);

        // Re-invalidate on container resize (e.g. sidebar toggle, window resize)
        if (window.ResizeObserver && mapContainerRef.current) {
            const ro = new ResizeObserver(() => mapInstance.current?.invalidateSize());
            ro.observe(mapContainerRef.current);
            mapInstance.current._ro = ro;
        }
    }, [currentHospital]);

    const updateMapMarkers = useCallback(() => {
        if (!window.L || !mapInstance.current) return;

        // Clear markers no longer active
        Object.keys(markersRef.current).forEach(id => {
            const isDispatchMarker = dispatches.find(d => d.id === id && d.status !== 'completed');
            const isAmbulanceMarker = id.startsWith('amb-') && hospitalFleet.find(a => `amb-${a.id}` === id);
            if (!isDispatchMarker && !isAmbulanceMarker) {
                markersRef.current[id].remove();
                delete markersRef.current[id];
            }
        });

        // Patient markers
        dispatches.filter(d => d.status !== 'completed').forEach(dispatch => {
            if (!dispatch.patientPosition?.[0] || !dispatch.patientPosition?.[1]) return;

            const icon = window.L.divIcon({
                className: `map-marker-${(dispatch.priority || 'high').toLowerCase()}`,
                html: `<div class="marker-pulse"></div><div class="marker-core"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            if (!markersRef.current[dispatch.id]) {
                markersRef.current[dispatch.id] = window.L.marker(dispatch.patientPosition, { icon })
                    .addTo(mapInstance.current)
                    .bindPopup(`<b>${dispatch.requestId}</b><br/>${dispatch.patientName}<br/>${dispatch.emergencyType}`);
            } else {
                markersRef.current[dispatch.id].setLatLng(dispatch.patientPosition);
            }
        });

        // Ambulance markers — real GPS positions, kept in sync via location_update socket
        hospitalFleet.forEach(ambulance => {
            if (!ambulance.locationLat || !ambulance.locationLng) return;
            const pos = [ambulance.locationLat, ambulance.locationLng];
            const isBusy = !ambulance.isAvailable;
            const ambIcon = window.L.divIcon({
                className: 'dd-ambulance-icon',
                html: `<div style="background:${isBusy ? '#ef4444' : '#2563eb'};border-radius:50%;padding:4px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);"><svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5"><path d="M10 17h.01"/><path d="M14 17h.01"/><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z"/><path d="M6 13V8l4-4h4l4 4v5"/></svg></div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            });
            const markerId = `amb-${ambulance.id}`;
            const popupContent = `<b>${ambulance.plateNumber}</b><br/>Driver: ${ambulance.driver?.name || 'Unassigned'}<br/>Status: ${isBusy ? '🔴 On Dispatch' : '🟢 Available'}<br/><small>${ambulance.locationLat.toFixed(5)}, ${ambulance.locationLng.toFixed(5)}</small>`;
            if (!markersRef.current[markerId]) {
                markersRef.current[markerId] = window.L.marker(pos, { icon: ambIcon })
                    .addTo(mapInstance.current)
                    .bindPopup(popupContent);
            } else {
                markersRef.current[markerId].setLatLng(pos);
                markersRef.current[markerId].setPopupContent(popupContent);
            }
        });

        if (activeDispatch?.patientPosition?.[0]) {
            mapInstance.current.panTo(activeDispatch.patientPosition);
        }
    }, [dispatches, activeDispatch, hospitalFleet]);

    useEffect(() => {
        if (activeTab === 'dashboard') {
            // Re-init map whenever hospital data becomes available or tab switches
            if (mapInstance.current) {
                mapInstance.current._ro?.disconnect();
                mapInstance.current.remove();
                mapInstance.current = null;
                markersRef.current = {};
            }
            initMap();
        } else if (mapInstance.current) {
            mapInstance.current._ro?.disconnect();
            mapInstance.current.remove();
            mapInstance.current = null;
            markersRef.current = {};
        }
    }, [activeTab, initMap, currentHospital?.id]);

    useEffect(() => {
        updateMapMarkers();
    }, [dispatches, activeDispatch, hospitalFleet, updateMapMarkers]);

    useEffect(() => {
        setCapacityForm(hospitalCapacity);
    }, [hospitalCapacity]);

    const handleCapacityChange = (key, value) => {
        setSyncMessage('');
        setCapacityForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const handleUpdateCapacity = async () => {
        const result = await updateHospitalCapacity({
            icuAvailable: Number(capacityForm.icuAvailable),
            generalAvailable: Number(capacityForm.generalAvailable),
            ventilatorsAvailable: Number(capacityForm.ventilatorsAvailable),
        });
        setSyncMessage(result.ok ? 'Capacity records synced to the dispatch network.' : result.message);
    };

    const handleDispatchAction = async (dispatch) => {
        if (dispatch.status === 'incoming') {
            selectDispatch(dispatch.id);
            setTimeout(() => {
                const panel = document.querySelector('.assignment-panel');
                if (panel) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const select = panel.querySelector('select');
                    if (select) select.focus();
                }
            }, 100);
            return;
        }

        if (dispatch.status === 'in_transit') {
            const result = await updateDispatchStatus(dispatch.id, 'completed', 'Emergency desk completed hospital intake and handover.');
            if (!result?.ok) {
                setSyncMessage(result?.message || 'Unable to close the request right now.');
            }
            return;
        }

        // "Track" — open the tracking modal
        setTrackingDispatch(dispatch);
    };

    const handleAssignmentSelection = (dispatchId, ambulanceId) => {
        setSyncMessage('');
        setAssignmentSelections((current) => ({
            ...current,
            [dispatchId]: ambulanceId,
        }));
    };

    const handleRejectRequest = async (dispatchId) => {
        if (!window.confirm('Are you sure you want to reject/clear this request? It will be removed from your active queue.')) return;
        const result = await updateDispatchStatus(dispatchId, 'completed', 'Hospital desk rejected/cleared this emergency call.');
        if (!result?.ok) {
            setSyncMessage(result?.message || 'Unable to clear request.');
        }
    };

    return (
        <>
        <div className="hospital-dashboard-container">
            <div className="mobile-hospital-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/image.png" alt="ERIS Logo" className="app-logo" style={{ height: '32px' }} />
                    <span style={{ fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{hospitalName}</span>
                </div>
                <button
                    className="mobile-sidebar-toggle"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        {isSidebarOpen ? (
                            <path d="M18 6L6 18M6 6l12 12" />
                        ) : (
                            <path d="M4 12h16M4 6h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>

            <aside className={`hospital-sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
                <div className="hospital-sidebar-header">
                    <img src="/image.png" alt="ERIS Logo" className="app-logo" style={{ height: '56px', marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                        {hospitalName}
                    </div>
                </div>
                <nav className="hospital-nav">
                    <div
                        className={`hospital-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
                    >
                        Operational Overview
                    </div>
                    <div
                        className={`hospital-nav-item ${activeTab === 'capacity' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('capacity'); setIsSidebarOpen(false); }}
                    >
                        Bed Coordination
                    </div>
                    {isAdmin && (
                        <div
                            className={`hospital-nav-item ${activeTab === 'security' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('security'); setIsSidebarOpen(false); }}
                            style={{ color: activeTab === 'security' ? 'var(--emergency-red)' : undefined }}
                        >
                            🛡️ Anti-Abuse
                        </div>
                    )}
                    <div className="hospital-nav-item" style={{ color: 'var(--emergency-red)', marginTop: 'auto' }} onClick={logout}>
                        System Logout
                    </div>
                </nav>
            </aside>

            <main className="hospital-main">
                <header className="hospital-header">
                    <div>
                        <h1>EMERGENCY COMMAND PORTAL</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: '500' }}>
                            FACILITY: {hospitalName.toUpperCase()} | FACILITY ID: {hospitalId} | AVAILABLE AMBULANCES: {availableFleet}
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--success-green)', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-green)' }}></span>
                            NETWORK SYNCED
                        </div>
                        <div className="last-sync">UPDATED: {activeDispatch?.updatedAt || '--:--:--'}</div>
                    </div>
                </header>

                {activeTab === 'dashboard' ? (
                    <>
                        <div className="dashboard-map-section" style={{ marginBottom: '32px' }}>
                            <div className="section-label">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                                LIVE FLEET TRACKING
                            </div>
                            <div className="hospital-map-container" ref={mapContainerRef} style={{ height: '350px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-std)', boxShadow: 'var(--shadow-sm)' }}></div>
                        </div>

                        <div className="section-label">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                            </svg>
                            LIVE CAPACITY SNAPSHOT
                        </div>
                        <div className="hospital-kpi-grid dashboard-top-kpis">
                            <div className="hospital-kpi-card" style={{ borderLeft: '4px solid var(--emergency-red)' }}>
                                <span>Active Requests</span>
                                <strong>{dispatches.filter(d => d.status !== 'completed').length}</strong>
                            </div>
                            <div className="hospital-kpi-card" style={{ borderLeft: '4px solid var(--dept-blue)' }}>
                                <span>ICU Available</span>
                                <strong>{hospitalCapacity.icuAvailable}</strong>
                            </div>
                            <div className="hospital-kpi-card" style={{ borderLeft: '4px solid var(--dept-blue)' }}>
                                <span>General Available</span>
                                <strong>{hospitalCapacity.generalAvailable}</strong>
                            </div>
                            <div className="hospital-kpi-card" style={{ borderLeft: '4px solid var(--success-green)' }}>
                                <span>Available Fleet</span>
                                <strong>{availableFleet}</strong>
                            </div>
                        </div>

                        <div className="section-label">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6" />
                                <path d="M16 13H8" />
                                <path d="M16 17H8" />
                                <path d="M10 9H8" />
                            </svg>
                            ACTIVE EMERGENCY REQUESTS
                        </div>
                        <div className="table-responsive" style={{ marginBottom: '32px' }}>
                            <table className="queue-table">
                                <thead>
                                    <tr>
                                        <th>Case Details</th>
                                        <th>Assigned Unit</th>
                                        <th>Timeline</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dispatches.filter(d => d.status !== 'completed').length === 0 ? (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                                                Queue is clear. No active emergencies right now.
                                            </td>
                                        </tr>
                                    ) : (
                                        dispatches.filter(d => d.status !== 'completed').map((dispatch) => (
                                            <tr
                                                key={dispatch.id}
                                                className={`${dispatch.id === activeDispatch?.id ? 'queue-table-row-active ' : ''}${dispatch.priority === 'CRITICAL' ? 'critical-row' : ''}`}
                                                onClick={() => selectDispatch(dispatch.id)}
                                            >
                                                <td>
                                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{dispatch.requestId}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span className="priority-cell" style={{
                                                            padding: '2px 8px',
                                                            fontSize: '10px',
                                                            background: dispatch.priority === 'CRITICAL' ? 'var(--emergency-red-light)' : 'rgba(245, 158, 11, 0.15)',
                                                            color: dispatch.priority === 'CRITICAL' ? 'var(--emergency-red-dark)' : '#d97706'
                                                        }}>
                                                            {dispatch.priority}
                                                        </span>
                                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{dispatch.emergencyType}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dispatch.ambulanceId}</div>
                                                    <div className="queue-cell-subtext" style={{ color: 'var(--text-secondary)' }}>
                                                        {dispatch.driverName}
                                                        {dispatch.driverId ? ` (ID: ${dispatch.driverId.slice(0, 8).toUpperCase()})` : ''}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 800, color: 'var(--dept-blue-dark)', fontSize: '13px' }}>{dispatch.eta}</div>
                                                    <div className="queue-cell-subtext">{statusLabels[dispatch.status] || dispatch.status}</div>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                        <button 
                                                            className="action-cell-btn" 
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleDispatchAction(dispatch);
                                                            }}
                                                        >
                                                            {dispatch.status === 'incoming' ? 'Dispatch' : dispatch.status === 'in_transit' ? 'Confirm Arrival' : 'Track'}
                                                        </button>
                                                        <button 
                                                            className="action-cell-btn reject-btn" 
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleRejectRequest(dispatch.id);
                                                            }}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                color: 'var(--emergency-red)',
                                                                padding: '8px 12px',
                                                                minWidth: 'auto',
                                                                boxShadow: 'none',
                                                                border: '1px solid rgba(239, 68, 68, 0.2)'
                                                            }}
                                                            title="Clear/Reject Request"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="capacity-grid dashboard-bottom-grid">
                            <div className="hospital-fleet-card">
                                <div className="section-label" style={{ marginBottom: '20px' }}>
                                    FACILITY FLEET ROSTER
                                </div>
                                <div className="fleet-meta-line">
                                    This hospital account controls only: <strong>{hospitalName}</strong>
                                </div>
                                <div className="fleet-meta-line">
                                    Hospital ID: <span className="fleet-code">{hospitalId}</span>
                                </div>
                                <div className="table-responsive">
                                    <table className="fleet-table">
                                        <thead>
                                            <tr>
                                                <th>Ambulance</th>
                                                <th>Driver</th>
                                                <th>Driver ID</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hospitalFleet.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>No ambulances are linked to this hospital account.</td>
                                                </tr>
                                            ) : (
                                                hospitalFleet.map((ambulance) => (
                                                    <tr key={ambulance.id}>
                                                        <td>
                                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ambulance.plateNumber}</div>
                                                            <div className="queue-cell-subtext">{ambulance.id.slice(0, 8).toUpperCase()}</div>
                                                        </td>
                                                        <td>
                                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ambulance.driver?.name || 'No driver linked'}</div>
                                                            <div className="queue-cell-subtext">{ambulance.driver?.email || 'No driver email'}</div>
                                                        </td>
                                                        <td className="fleet-code">
                                                            {ambulance.driver?.id ? ambulance.driver.id.slice(0, 8).toUpperCase() : 'UNLINKED'}
                                                        </td>
                                                        <td>
                                                            <span className={`fleet-status-pill ${ambulance.isAvailable ? 'available' : 'busy'}`}>
                                                                {ambulance.isAvailable ? 'Available' : 'Busy'}
                                                            </span>
                                                            {ambulance.locationLat && ambulance.locationLng && (
                                                                <div className="queue-cell-subtext" style={{ marginTop: '4px', fontSize: '10px' }}>
                                                                    📍 {ambulance.locationLat.toFixed(4)}, {ambulance.locationLng.toFixed(4)}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="hospital-briefing-card">
                                <div className="section-label" style={{ marginBottom: '20px' }}>
                                    DISPATCH BRIEFING FEED
                                </div>
                                {activeDispatch?.status === 'incoming' ? (
                                    <div className="assignment-panel" style={{ background: 'var(--dept-blue-light)', border: '1px solid var(--dept-blue)' }}>
                                        <div className="assignment-panel-title" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '24px' }}>🚨</span> Action Required: Assign Ambulance
                                        </div>
                                        <div className="assignment-panel-copy" style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>
                                            Emergency Request <strong>{activeDispatch.requestId}</strong> is currently unassigned. Please dispatch an available unit immediately.
                                        </div>
                                        <select
                                            className="assignment-select"
                                            value={assignmentSelections[activeDispatch.id] || ''}
                                            onChange={(event) => handleAssignmentSelection(activeDispatch.id, event.target.value)}
                                            style={{ padding: '14px', fontSize: '16px', boxShadow: 'var(--shadow-sm)' }}
                                        >
                                            <option value="">-- Click to choose ambulance and driver --</option>
                                            {availableFleetOptions.map((ambulance) => (
                                                <option key={ambulance.id} value={ambulance.id}>
                                                    {ambulance.plateNumber} (Driver: {ambulance.driver?.name || 'Unknown'})
                                                </option>
                                            ))}
                                        </select>
                                        <div className="assignment-panel-copy" style={{ marginBottom: '20px', fontSize: '12px' }}>
                                            Facility: <span className="fleet-code">{hospitalId}</span>
                                        </div>
                                        <button 
                                            className="btn-update" 
                                            disabled={!assignmentSelections[activeDispatch.id]}
                                            style={{ 
                                                opacity: !assignmentSelections[activeDispatch.id] ? 0.6 : 1, 
                                                cursor: !assignmentSelections[activeDispatch.id] ? 'not-allowed' : 'pointer',
                                                padding: '16px',
                                                fontSize: '16px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}
                                            onClick={async () => {
                                                const selectedAmbulanceId = assignmentSelections[activeDispatch.id];
                                                const result = await assignDispatch(activeDispatch.id, selectedAmbulanceId);
                                                if (!result?.ok) {
                                                    alert(result?.message || 'Unable to assign an ambulance right now.');
                                                } else {
                                                    setAssignmentSelections((current) => {
                                                        const next = { ...current };
                                                        delete next[activeDispatch.id];
                                                        return next;
                                                    });
                                                }
                                            }}
                                        >
                                            Confirm Assignment
                                        </button>
                                    </div>
                                ) : null}
                                <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                                    {activeDispatch?.logs?.slice().reverse().map((log) => (
                                        <div key={log.id} className="hospital-feed-item">
                                            <div className={`hospital-feed-type ${log.type}`}>{log.type}</div>
                                            <div>
                                                <strong>{log.message}</strong>
                                                <div className="hospital-feed-time">{log.timestamp}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!activeDispatch || !activeDispatch.logs?.length) && (
                                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                                            Select a dispatch to view timeline logs.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : activeTab === 'security' ? (
                    /* ── Anti-Abuse / Security Panel (ADMIN only) ── */
                    <div>
                        <div className="hospital-header" style={{ marginBottom: '24px' }}>
                            <div>
                                <h1>🛡️ ANTI-ABUSE CONTROL</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                                    Suspicious requests, device trust scores, and blacklist management
                                </p>
                            </div>
                            <button className="btn-update" style={{ width: 'auto', padding: '10px 20px', marginTop: 0 }} onClick={loadSecurityData}>
                                {securityLoading ? 'Loading…' : '↻ Refresh'}
                            </button>
                        </div>

                        <div className="section-label" style={{ marginBottom: '16px' }}>⚠️ SUSPICIOUS / FAKE REQUESTS</div>
                        <div className="table-responsive" style={{ marginBottom: '40px' }}>
                            <table className="queue-table">
                                <thead>
                                    <tr>
                                        <th>Request ID</th><th>Type</th><th>Reason</th>
                                        <th>Trust Score</th><th>Status</th><th>Device</th><th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suspiciousRequests.length === 0 ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                                            {securityLoading ? 'Loading…' : 'No suspicious requests found.'}
                                        </td></tr>
                                    ) : suspiciousRequests.map(r => (
                                        <tr key={r.id} style={{ background: r.isFake ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.04)' }}>
                                            <td><span className="fleet-code">{r.id.slice(0, 8).toUpperCase()}</span></td>
                                            <td style={{ fontSize: '12px' }}>{r.emergencyType}</td>
                                            <td style={{ fontSize: '11px', color: 'var(--warning-orange)', maxWidth: '200px' }}>{r.suspiciousReason || (r.isFake ? 'Marked fake by driver' : '—')}</td>
                                            <td><span style={{ fontWeight: 800, fontSize: '13px', color: (r.trustScoreAtRequest ?? 0) < 0 ? 'var(--emergency-red)' : 'var(--success-green)' }}>{r.trustScoreAtRequest ?? '—'}</span></td>
                                            <td><span className={`fleet-status-pill ${r.isFake ? 'busy' : 'available'}`}>{r.isFake ? 'FAKE' : r.status}</span></td>
                                            <td style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{r.deviceId ? r.deviceId.slice(0, 12) + '…' : r.ipAddress || '—'}</td>
                                            <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{new Date(r.createdAt).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="section-label" style={{ marginBottom: '16px' }}>📱 DEVICE TRUST SCORES</div>
                        <div className="table-responsive">
                            <table className="queue-table">
                                <thead>
                                    <tr>
                                        <th>Device ID</th><th>Trust Score</th><th>Valid</th>
                                        <th>Fake</th><th>Status</th><th style={{ textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deviceList.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                                            {securityLoading ? 'Loading…' : 'No device records yet.'}
                                        </td></tr>
                                    ) : deviceList.map(d => (
                                        <tr key={d.deviceId} style={{ background: d.isBlacklisted ? 'rgba(239,68,68,0.06)' : undefined }}>
                                            <td><span className="fleet-code" style={{ fontSize: '11px' }}>{d.deviceId.slice(0, 16)}…</span></td>
                                            <td><span style={{ fontWeight: 900, fontSize: '16px', color: d.trustScore < 0 ? 'var(--emergency-red)' : d.trustScore > 2 ? 'var(--success-green)' : 'var(--text-primary)' }}>{d.trustScore}</span></td>
                                            <td style={{ color: 'var(--success-green)', fontWeight: 700 }}>{d.totalValid}</td>
                                            <td style={{ color: 'var(--emergency-red)', fontWeight: 700 }}>{d.totalFake}</td>
                                            <td><span className={`fleet-status-pill ${d.isBlacklisted ? 'busy' : 'available'}`}>{d.isBlacklisted ? 'BLACKLISTED' : 'Active'}</span></td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="action-cell-btn"
                                                    style={{ background: d.isBlacklisted ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)', color: d.isBlacklisted ? 'var(--success-green)' : 'var(--emergency-red)', boxShadow: 'none', border: `1px solid ${d.isBlacklisted ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}
                                                    onClick={() => handleBlacklist(d.deviceId, !d.isBlacklisted)}
                                                >
                                                    {d.isBlacklisted ? 'Unblock' : 'Blacklist'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="hospital-capacity-layout">
                        <div>
                            <div className="section-label">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                </svg>
                                FACILITY CAPACITY MANAGEMENT
                            </div>

                            <div style={{ background: 'var(--bg-main)', padding: '32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-std)' }}>
                                <div className="table-responsive">
                                    <table className="beds-table" style={{ border: 'none', margin: 0 }}>
                                        <tbody>
                                            <tr>
                                                <td><b>ICU BEDS AVAILABLE</b></td>
                                                <td><input type="number" value={capacityForm.icuAvailable} onChange={(e) => handleCapacityChange('icuAvailable', e.target.value)} /></td>
                                            </tr>
                                            <tr>
                                                <td><b>GENERAL BEDS AVAILABLE</b></td>
                                                <td><input type="number" value={capacityForm.generalAvailable} onChange={(e) => handleCapacityChange('generalAvailable', e.target.value)} /></td>
                                            </tr>
                                            <tr>
                                                <td><b>VENTILATORS (CRITICAL)</b></td>
                                                <td><input type="number" value={capacityForm.ventilatorsAvailable} onChange={(e) => handleCapacityChange('ventilatorsAvailable', e.target.value)} /></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <button className="btn-update" onClick={handleUpdateCapacity}>Confirm & Sync Update</button>
                                <div className="last-sync" style={{ marginTop: '24px' }}>
                                    TIMESTAMPED: {activeDispatch?.updatedAt || '--:--:--'}
                                </div>
                                {syncMessage ? <div className="capacity-sync-note">{syncMessage}</div> : null}
                            </div>
                        </div>

                        <div className="hospital-briefing-card">
                            <div className="section-label" style={{ marginBottom: '20px' }}>
                                SELECTED DISPATCH
                            </div>
                            {activeDispatch ? (
                                <div className="selected-dispatch-card" style={{ borderTop: '4px solid var(--dept-blue)' }}>
                                    <h3 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px' }}>{activeDispatch.patientName}</h3>
                                    <p style={{ fontWeight: '600', color: 'var(--emergency-red)' }}>{activeDispatch.emergencyType}</p>
                                    <div className="selected-dispatch-meta">
                                        <span>{activeDispatch.requestId}</span>
                                        <span>{statusLabels[activeDispatch.status]}</span>
                                    </div>
                                    <div className="selected-dispatch-notes">
                                        <div className="section-label" style={{ marginBottom: '8px' }}>Assigned Unit</div>
                                        <div>Hospital: {activeDispatch.hospitalName}</div>
                                        <div>Ambulance: {activeDispatch.ambulanceId}</div>
                                        <div>Driver: {activeDispatch.driverName}</div>
                                        <div>{activeDispatch.driverEmail || 'Driver email will appear after assignment.'}</div>
                                    </div>
                                    <div className="selected-dispatch-notes">
                                        <div className="section-label" style={{ marginBottom: '8px' }}>Pickup Address</div>
                                        <div>{activeDispatch.pickupAddress}</div>
                                    </div>
                                    <div className="selected-dispatch-notes">
                                        <div className="section-label" style={{ marginBottom: '8px' }}>Medical Notes</div>
                                        <div>{activeDispatch.medicalNotes || 'No additional notes were submitted by the caller.'}</div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </main>
        </div>

        {/* ── Tracking Modal ── */}
        {trackingDispatch && (
            <div className="track-modal-overlay" onClick={closeTrackingModal}>
                <div className="track-modal" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="track-modal-header">
                        <div>
                            <div className="track-modal-title">
                                <span className="track-modal-status-dot" />
                                Live Tracking — {trackingDispatch.requestId}
                            </div>
                            <div className="track-modal-subtitle">
                                {trackingDispatch.patientName} · {trackingDispatch.emergencyType} · {trackingDispatch.ambulanceId}
                            </div>
                        </div>
                        <button className="track-modal-close" onClick={closeTrackingModal} aria-label="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Map */}
                    <div className="track-modal-map-wrap">
                        <div ref={trackMapContainerRef} className="track-modal-map" />
                    </div>

                    {/* Live location strip — just below the map */}
                    <div className="track-modal-coords">
                        <div className="track-modal-coords-left">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span className="track-modal-coords-label">Driver live location</span>
                            {liveCoords ? (
                                <span className="track-modal-coords-value">
                                    {liveCoords.lat.toFixed(6)}, {liveCoords.lng.toFixed(6)}
                                </span>
                            ) : (
                                <span className="track-modal-coords-waiting">
                                    {trackingDispatch.ambulancePosition
                                        ? `${trackingDispatch.ambulancePosition[0].toFixed(6)}, ${trackingDispatch.ambulancePosition[1].toFixed(6)}`
                                        : 'Waiting for driver GPS…'}
                                </span>
                            )}
                        </div>
                        <div className="track-modal-coords-right">
                            {liveCoords && (
                                <>
                                    <span className="live-dot" style={{ width: '6px', height: '6px' }} />
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        Updated {liveCoords.updatedAt.toLocaleTimeString()}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Info row */}
                    <div className="track-modal-info">
                        <div className="track-modal-info-item">
                            <span>Driver</span>
                            <strong>{trackingDispatch.driverName}</strong>
                        </div>
                        <div className="track-modal-info-item">
                            <span>ETA</span>
                            <strong style={{ color: 'var(--dept-blue)' }}>{trackingDispatch.eta}</strong>
                        </div>
                        <div className="track-modal-info-item">
                            <span>Status</span>
                            <strong>{statusLabels[trackingDispatch.status] || trackingDispatch.status}</strong>
                        </div>
                        <div className="track-modal-info-item">
                            <span>Priority</span>
                            <strong style={{ color: trackingDispatch.priority === 'CRITICAL' ? 'var(--emergency-red)' : 'var(--warning-orange)' }}>
                                {trackingDispatch.priority}
                            </strong>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

export default HospitalDashboard;
