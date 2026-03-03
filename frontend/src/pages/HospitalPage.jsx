import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HospitalPage.css';

/**
 * Professional Hospital Emergency Command Dashboard
 * Standardized for dispatch monitoring and capacity management.
 */
function HospitalPage() {
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

    const HospitalDashboard = () => (
        <div className="hospital-page">
            {/* Command Sidebar */}
            <aside className="hospital-sidebar">
                <div className="hospital-sidebar-header" style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '1px' }}>
                    CITY GENERAL EMERGENCY
                </div>
                <nav className="hospital-nav">
                    <div className="hospital-nav-item active">Operational Overview</div>
                    <div className="hospital-nav-item">Bed Coordination</div>
                    <div className="sidebar-nav-item" style={{ color: '#FFCDD2', padding: '16px 30px', cursor: 'pointer' }} onClick={() => navigate('/')}>
                        System Logout
                    </div>
                </nav>
            </aside>

            {/* Main Application Area */}
            <main className="hospital-main">
                <header className="hospital-header">
                    <div>
                        <h1 style={{ fontSize: '28px', color: '#0D47A1' }}>EMERGENCY COMMAND PORTAL</h1>
                        <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>FACILITY: CITY GENERAL HOSPITAL | DISPATCH PROTOCOL: ALPHA</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#2E7D32', fontWeight: 800, fontSize: '13px' }}>● NETWORK STATUS: SYNCED</div>
                        <div className="last-sync">UPDATED: {lastSync}</div>
                    </div>
                </header>

                <div className="section-label">INCOMING AMBULANCE DISPATCH RECORDS</div>
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
                                <td style={{ fontWeight: 700 }}>{p.id}</td>
                                <td className="priority-cell" style={{ color: p.priority === 'CRITICAL' ? '#C62828' : '#EF6C00' }}>
                                    {p.priority}
                                </td>
                                <td>{p.diagnosis}</td>
                                <td>{p.ambulance}</td>
                                <td style={{ fontWeight: 700 }}>{p.eta}</td>
                                <td><button className="action-cell-btn">Assign Unit</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ marginTop: '50px', display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 2fr', gap: '40px' }}>

                    {/* Capacity Management Section */}
                    <div>
                        <div className="section-label">FACILITY CAPACITY MANAGEMENT</div>
                        <div className="card-std" style={{ padding: '24px' }}>
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
                            <div className="last-sync">TIMESTAMPED: {lastSync}</div>
                        </div>
                    </div>

                    {/* Dispatch Briefing - Placeholder for side info if needed */}
                    <div style={{ background: '#fcfcfc', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontWeight: 700 }}>
                        DISPATCH RADIOLOGS / BRIEFING FEED
                    </div>

                </div>
            </main>
        </div>
    );

    return <HospitalDashboard />;
}

export default HospitalPage;
