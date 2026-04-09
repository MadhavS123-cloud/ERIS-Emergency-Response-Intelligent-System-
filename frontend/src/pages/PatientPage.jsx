import React from 'react';
import { Link } from 'react-router-dom';
import EmergencyForm from '../components/EmergencyForm';
import BackButton from '../components/BackButton';
import './PatientPage.css';

function PatientPage() {

    return (
        <div className="patient-page-root">
            <header className="patient-page-header">
                <div className="patient-page-header-inner">
                    <BackButton />
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                        <img src="/image.png" alt="ERIS Logo" className="app-logo" style={{ height: '40px' }} />
                    </Link>
                </div>
            </header>

            <main className="patient-page-main">
                <EmergencyForm />
            </main>
        </div>
    );
}

export default PatientPage;
