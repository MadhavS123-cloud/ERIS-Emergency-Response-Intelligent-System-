import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HospitalDashboard.css';

/**
 * Professional Hospital Emergency Command Dashboard
 * Standardized for dispatch monitoring and capacity management.
 */
function HospitalDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString());

    // Bed Counts State
    const [icuAvailable, setIcuAvailable] = useState(12);
    const [generalAvailable, setGeneralAvailable] = useState(48);
    const [ventilatorsAvailable, setVentilatorsAvailable] = useState(5);

    // Mock Emergency Patient Queue
    const [patients, setPatients] = useState([
        { id: 'PAT-772', eta: '4 min', diagnosis: 'CARDIAC DISTRESS', ambulance: 'AMB-2451', priority: 'CRITICAL', status: 'INCOMING' },
        { id: 'PAT-109', eta: '8 min', diagnosis: 'TRAUMA / ACCIDENT', ambulance: 'AMB-1893', priority: 'HIGH', status: 'INCOMING' },
        { id: 'PAT-441', eta: '12 min', diagnosis: 'STROKE SYMPTOMS', ambulance: 'AMB-3127', priority: 'CRITICAL', status: 'INCOMING' },
    ]);

    const handleUpdateCapacity = () => {
        setLastSync(new Date().toLocaleTimeString());
        alert('Hospital capacity records updated on central server.');
    };

    return (
        <div className="hospital-dashboard-container">
            {/* Command Sidebar */}
            <aside className="hospital-sidebar">
                <div className="hospital-sidebar-header">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--dept-blue)" strokeWidth="2.5">
                        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                        <path d="M12 7v4" />
                        <path d="M10 9h4" />
                    </svg>
                    <div style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                        CITY GENERAL
                    </div>
                </div>
                <nav className="hospital-nav">
                    <div className="hospital-nav-item active">Operational Overview</div>
                    <div className="hospital-nav-item">Bed Coordination</div>
                    <div className="hospital-nav-item" style={{ color: 'var(--emergency-red)', marginTop: 'auto' }} onClick={() => navigate('/')}>
                        System Logout
                    </div>
                </nav>
            </aside>

            {/* Main Application Area */}
            <main className="hospital-main">
                <header className="hospital-header">
                    <div>
                        <h1>EMERGENCY COMMAND PORTAL</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: '500' }}>FACILITY: CITY GENERAL HOSPITAL | DISPATCH PROTOCOL: ALPHA</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--success-green)', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-green)' }}></span>
                            NETWORK SYNCED
                        </div>
                        <div className="last-sync">UPDATED: {lastSync}</div>
                    </div>
                </header>

                <div className="section-label">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                    INCOMING AMBULANCE DISPATCH RECORDS
                </div>
                <table className="queue-table">
                    <thead>
                        <tr>
                            <th>Patient ID</th>
                            <th>Priority</th>
                            <th>Emergency / Diagnosis</th>
                            <th>EMS unit</th>
                            <th>ETA (EST)</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {patients.map((p, idx) => (
                            <tr key={idx}>
                                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.id}</td>
                                <td>
                                    <span className="priority-cell" style={{
                                        background: p.priority === 'CRITICAL' ? 'var(--emergency-red-light)' : 'rgba(245, 158, 11, 0.15)',
                                        color: p.priority === 'CRITICAL' ? 'var(--emergency-red-dark)' : '#d97706'
                                    }}>
                                        {p.priority}
                                    </span>
                                </td>
                                <td>{p.diagnosis}</td>
                                <td style={{ fontFamily: 'monospace', fontWeight: '500' }}>{p.ambulance}</td>
                                <td style={{ fontWeight: 800, color: 'var(--dept-blue-dark)' }}>{p.eta}</td>
                                <td><button className="action-cell-btn">Assign Unit</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ marginTop: '48px', display: 'grid', gridTemplateColumns: 'minmax(420px, 1fr) 2fr', gap: '48px' }}>

                    {/* Capacity Management Section */}
                    <div>
                        <div className="section-label">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                            FACILITY CAPACITY MANAGEMENT
                        </div>
                        <div style={{ background: 'var(--bg-main)', padding: '32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-std)' }}>
                            <table className="beds-table" style={{ border: 'none', margin: 0 }}>
                                <tbody>
                                    <tr>
                                        <td><b>ICU BEDS AVAILABLE</b></td>
                                        <td><input type="number" value={icuAvailable} onChange={(e) => setIcuAvailable(e.target.value)} /></td>
                                    </tr>
                                    <tr>
                                        <td><b>GENERAL BEDS AVAILABLE</b></td>
                                        <td><input type="number" value={generalAvailable} onChange={(e) => setGeneralAvailable(e.target.value)} /></td>
                                    </tr>
                                    <tr>
                                        <td><b>VENTILATORS (CRITICAL)</b></td>
                                        <td><input type="number" value={ventilatorsAvailable} onChange={(e) => setVentilatorsAvailable(e.target.value)} /></td>
                                    </tr>
                                </tbody>
                            </table>
                            <button className="btn-update" onClick={handleUpdateCapacity}>Confirm & Sync Update</button>
                            <div className="last-sync" style={{ marginTop: '24px' }}>TIMESTAMPED: {lastSync}</div>
                        </div>
                    </div>

                    {/* Dispatch Briefing */}
                    <div style={{
                        background: 'var(--bg-main)',
                        border: '2px dashed var(--border-std)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        opacity: 0.7
                    }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px', opacity: 0.5 }}>
                            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z" />
                            <path d="M12 6v6l4 2" />
                        </svg>
                        DISPATCH RADIOLOGS / BRIEFING FEED
                    </div>

                </div>
            </main>
        </div>
    );
}

export default HospitalDashboard;
