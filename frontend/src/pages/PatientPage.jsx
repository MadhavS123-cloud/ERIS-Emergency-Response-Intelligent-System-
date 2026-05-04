import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import EmergencyForm from '../components/EmergencyForm';
import BackButton from '../components/BackButton';
import { socket } from '../socket'; // ✅ USE THIS
import './PatientPage.css';

function PatientPage() {

    useEffect(() => {
        // ✅ Listen when driver is assigned
        socket.on("driver_assigned", (data) => {
            console.log("🚑 Driver assigned:", data);

            // ✅ Join room using requestId
            socket.emit("join_room", data.requestId);
        });

        return () => {
            socket.off("driver_assigned");
        };
    }, []);

    return (
        <div className="patient-page-root">
            <header className="patient-page-header">
                <div className="patient-page-header-inner">
                    <BackButton />
                    <Link to="/" className="patient-page-logo-link">
                        <span className="eris-mark" aria-hidden="true">E</span>
                        <span className="patient-page-logo-text">ERIS</span>
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