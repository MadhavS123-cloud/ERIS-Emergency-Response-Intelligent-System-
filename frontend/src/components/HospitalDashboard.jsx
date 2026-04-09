import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEris } from '../context/ErisContext';
import authService from '../services/authService';
import { addTomTomLayers } from '../config/tomtom';
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
    const currentUser = authService.getUser();
    const hospitalName = currentHospital?.name || `Hospital Account: ${currentUser?.hospitalId || 'Unlinked'}`;
    const hospitalId = currentHospital?.id || currentUser?.hospitalId || 'Unlinked';
    const availableFleet = hospitalFleet.filter((ambulance) => ambulance.isAvailable).length;
    const availableFleetOptions = hospitalFleet.filter((ambulance) => ambulance.isAvailable);
    
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
    }, [currentHospital]);

    const updateMapMarkers = useCallback(() => {
        if (!window.L || !mapInstance.current) return;

        // Clear markers no longer active
        Object.keys(markersRef.current).forEach(id => {
            const stillActive = dispatches.find(d => d.id === id && d.status !== 'completed')
                || hospitalFleet.find(a => a.id === id);
            if (!stillActive) {
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

        // Ambulance markers — real GPS positions from database
        hospitalFleet.forEach(ambulance => {
            if (!ambulance.locationLat || !ambulance.locationLng) return;
            const pos = [ambulance.locationLat, ambulance.locationLng];
            const ambIcon = window.L.divIcon({
                className: 'dd-ambulance-icon',
                html: `<div style="background:#2563eb;border-radius:50%;padding:4px;display:flex;align-items:center;justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5"><path d="M10 17h.01"/><path d="M14 17h.01"/><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z"/><path d="M6 13V8l4-4h4l4 4v5"/></svg></div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            });
            const markerId = `amb-${ambulance.id}`;
            if (!markersRef.current[markerId]) {
                markersRef.current[markerId] = window.L.marker(pos, { icon: ambIcon })
                    .addTo(mapInstance.current)
                    .bindPopup(`<b>${ambulance.plateNumber}</b><br/>${ambulance.isAvailable ? 'Available' : 'On dispatch'}`);
            } else {
                markersRef.current[markerId].setLatLng(pos);
            }
        });

        if (activeDispatch?.patientPosition?.[0]) {
            mapInstance.current.panTo(activeDispatch.patientPosition);
        }
    }, [dispatches, activeDispatch, hospitalFleet]);

    useEffect(() => {
        if (activeTab === 'dashboard') {
            initMap();
        } else if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
            markersRef.current = {};
        }
    }, [activeTab, initMap]);

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

        selectDispatch(dispatch.id);
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
                        onClick={() => {
                            setActiveTab('dashboard');
                            setIsSidebarOpen(false);
                        }}
                    >
                        Operational Overview
                    </div>
                    <div
                        className={`hospital-nav-item ${activeTab === 'capacity' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('capacity');
                            setIsSidebarOpen(false);
                        }}
                    >
                        Bed Coordination
                    </div>
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
    );
}

export default HospitalDashboard;
