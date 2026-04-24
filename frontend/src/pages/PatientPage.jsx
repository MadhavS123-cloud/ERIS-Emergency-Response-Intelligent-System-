import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import EmergencyForm from '../components/EmergencyForm';
import BackButton from '../components/BackButton';
import { socket } from '../socket'; // ✅ USE THIS

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
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
            
            {/* Header */}
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

            {/* Main */}
            <main style={{ padding: '40px 20px' }}>
                <EmergencyForm />
            </main>
        </div>
    );
}

export default PatientPage;