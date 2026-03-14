import React from 'react';
import { Link } from 'react-router-dom';
import EmergencyForm from '../components/EmergencyForm';

function PatientPage() {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fcfcfc' }}>
            {/* Simple Header */}
            <header style={{
                height: '70px',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                padding: '0 40px',
                borderBottom: '1px solid #eee',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                    <div style={{ background: '#C62828', padding: '6px', borderRadius: '4px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M10 17h.01" /><path d="M14 17h.01" /><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z" /><path d="M6 13V8l4-4h4l4 4v5" /><circle cx="7" cy="17" r="1" /><circle cx="17" cy="17" r="1" /></svg>
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: '#212121' }}>ERIS</span>
                </Link>
            </header>

            <main style={{ padding: '40px 20px' }}>
                <EmergencyForm />
            </main>
        </div>
    );
}

export default PatientPage;
