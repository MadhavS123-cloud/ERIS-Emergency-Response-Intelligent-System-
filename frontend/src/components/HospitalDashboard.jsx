import React, { useEffect, useState } from 'react';
import { useEris } from '../context/ErisContext';
import authService from '../services/authService';
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
            const selectedAmbulanceId = assignmentSelections[dispatch.id];
            if (!selectedAmbulanceId) {
                setSyncMessage('Choose an available ambulance from your hospital fleet before assigning the request.');
                return;
            }

            const result = await assignDispatch(dispatch.id, selectedAmbulanceId);
            if (!result?.ok) {
                setSyncMessage(result?.message || 'Unable to assign an ambulance right now.');
            } else {
                setAssignmentSelections((current) => {
                    const next = { ...current };
                    delete next[dispatch.id];
                    return next;
                });
            }
            return;
        }

        if (dispatch.status === 'en_route') {
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

                        <div className="table-responsive">
                            <table className="queue-table">
                                <thead>
                                    <tr>
                                        <th>Request ID</th>
                                        <th>Priority</th>
                                        <th>Emergency Type</th>
                                        <th>Ambulance ID</th>
                                        <th>Driver</th>
                                        <th>Arrival Time</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dispatches.map((dispatch) => (
                                        <tr
                                            key={dispatch.id}
                                            className={`${dispatch.id === activeDispatch?.id ? 'queue-table-row-active ' : ''}${dispatch.priority === 'CRITICAL' ? 'critical-row' : ''}`}
                                            onClick={() => selectDispatch(dispatch.id)}
                                        >
                                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dispatch.requestId}</td>
                                            <td>
                                                <span className="priority-cell" style={{
                                                    background: dispatch.priority === 'CRITICAL' ? 'var(--emergency-red-light)' : 'rgba(245, 158, 11, 0.15)',
                                                    color: dispatch.priority === 'CRITICAL' ? 'var(--emergency-red-dark)' : '#d97706'
                                                }}>
                                                    {dispatch.priority}
                                                </span>
                                            </td>
                                            <td>{dispatch.emergencyType}</td>
                                            <td style={{ fontFamily: 'monospace', fontWeight: '500' }}>
                                                <div>{dispatch.ambulanceId}</div>
                                                {dispatch.ambulanceInternalId ? (
                                                    <div className="queue-cell-subtext">{dispatch.ambulanceInternalId.slice(0, 8).toUpperCase()}</div>
                                                ) : null}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dispatch.driverName}</div>
                                                <div className="queue-cell-subtext">
                                                    {dispatch.driverId ? `ID: ${dispatch.driverId.slice(0, 8).toUpperCase()}` : 'No driver assigned yet'}
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 800, color: 'var(--dept-blue-dark)' }}>{dispatch.eta}</td>
                                            <td>{statusLabels[dispatch.status] || dispatch.status}</td>
                                            <td>
                                                {dispatch.status === 'completed' ? (
                                                    <span className="table-status-pill complete">Closed</span>
                                                ) : (
                                                    <button className="action-cell-btn" onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDispatchAction(dispatch);
                                                    }}>
                                                        {dispatch.status === 'incoming' ? 'Assign Ambulance' : dispatch.status === 'en_route' ? 'Confirm Arrival' : 'Track Live'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="capacity-grid">
                            <div>
                                <div className="section-label">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                    </svg>
                                    LIVE CAPACITY SNAPSHOT
                                </div>
                                <div className="hospital-kpi-grid">
                                    <div className="hospital-kpi-card">
                                        <span>ICU</span>
                                        <strong>{hospitalCapacity.icuAvailable}</strong>
                                    </div>
                                    <div className="hospital-kpi-card">
                                        <span>General</span>
                                        <strong>{hospitalCapacity.generalAvailable}</strong>
                                    </div>
                                    <div className="hospital-kpi-card">
                                        <span>Ventilators</span>
                                        <strong>{hospitalCapacity.ventilatorsAvailable}</strong>
                                    </div>
                                </div>
                            </div>

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
                                                    <td colSpan="4">No ambulances are linked to this hospital account.</td>
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
                                    <div className="assignment-panel">
                                        <div className="assignment-panel-title">Manual Ambulance Assignment</div>
                                        <div className="assignment-panel-copy">
                                            Pick one available ambulance from <strong>{hospitalName}</strong> for request <strong>{activeDispatch.requestId}</strong>.
                                        </div>
                                        <select
                                            className="assignment-select"
                                            value={assignmentSelections[activeDispatch.id] || ''}
                                            onChange={(event) => handleAssignmentSelection(activeDispatch.id, event.target.value)}
                                        >
                                            <option value="">Choose ambulance and driver</option>
                                            {availableFleetOptions.map((ambulance) => (
                                                <option key={ambulance.id} value={ambulance.id}>
                                                    {ambulance.plateNumber} - {ambulance.driver?.name || 'No Driver'} - {ambulance.driver?.id?.slice(0, 8).toUpperCase() || 'UNLINKED'}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="assignment-panel-copy">
                                            Selected hospital ID: <span className="fleet-code">{hospitalId}</span>
                                        </div>
                                    </div>
                                ) : null}
                                {activeDispatch?.logs?.slice().reverse().map((log) => (
                                    <div key={log.id} className="hospital-feed-item">
                                        <div className={`hospital-feed-type ${log.type}`}>{log.type}</div>
                                        <div>
                                            <strong>{log.message}</strong>
                                            <div className="hospital-feed-time">{log.timestamp}</div>
                                        </div>
                                    </div>
                                ))}
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
                                <div className="selected-dispatch-card">
                                    <h3>{activeDispatch.patientName}</h3>
                                    <p>{activeDispatch.emergencyType}</p>
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
