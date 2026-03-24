import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import EmergencyForm from '../components/EmergencyForm';
import BackButton from '../components/BackButton';

function PatientPage() {

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
            {/* Simple Header */}
            <header style={{
                height: 'var(--header-height)',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 40px',
                borderBottom: '1px solid var(--border-std)',
                boxShadow: 'var(--shadow-sm)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <BackButton />
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                        <img src="/image.png" alt="ERIS Logo" className="app-logo" style={{ height: '40px' }} />
                    </Link>
                </div>
            </header>

            <main style={{ padding: '40px 20px' }}>
                <EmergencyForm />
            </main>
        </div>
    );
}

export default PatientPage;
