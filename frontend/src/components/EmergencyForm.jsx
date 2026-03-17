import React, { useState, useEffect, useRef } from 'react';
import './EmergencyForm.css';

function DispatchModal({ onClose }) {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeInOverlay 0.3s ease'
        }}>
            <style>{`
                @keyframes fadeInOverlay {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUpModal {
                    from { transform: translateY(40px) scale(0.95); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
                @keyframes pulseSiren {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5); }
                    50% { box-shadow: 0 0 0 18px rgba(220, 38, 38, 0); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
            <div style={{
                background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
                borderRadius: '24px',
                padding: '48px 40px 40px',
                maxWidth: '420px',
                width: '90%',
                textAlign: 'center',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)',
                animation: 'slideUpModal 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both'
            }}>
                {/* Siren Icon */}
                <div style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 28px',
                    animation: 'pulseSiren 1.6s ease-in-out infinite',
                    fontSize: '42px'
                }}>
                    🚑
                </div>

                {/* Title */}
                <h2 style={{
                    color: '#ffffff',
                    fontSize: '22px',
                    fontWeight: '800',
                    marginBottom: '10px',
                    letterSpacing: '-0.3px'
                }}>
                    Ambulance Dispatched!
                </h2>

                {/* Message */}
                <p style={{
                    color: '#94a3b8',
                    fontSize: '15px',
                    lineHeight: '1.7',
                    marginBottom: '28px'
                }}>
                    Emergency ambulance has been dispatched successfully to your location.
                    <br />
                    <span style={{ color: '#34d399', fontWeight: '600' }}>
                        Please stay calm — help is on the way.
                    </span>
                </p>

                {/* ETA Badge */}
                <div style={{
                    background: 'rgba(52, 211, 153, 0.12)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    borderRadius: '12px',
                    padding: '12px 20px',
                    marginBottom: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                }}>
                    <span style={{ fontSize: '20px' }}>⏱️</span>
                    <span style={{ color: '#a7f3d0', fontSize: '14px', fontWeight: '600' }}>
                        Estimated Arrival: <strong style={{ color: '#34d399' }}>5–10 minutes</strong>
                    </span>
                </div>

                {/* Tips */}
                <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    marginBottom: '32px',
                    textAlign: 'left'
                }}>
                    <p style={{ color: '#cbd5e1', fontSize: '13px', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        While you wait:
                    </p>
                    <ul style={{ color: '#94a3b8', fontSize: '13px', paddingLeft: '18px', margin: 0, lineHeight: '1.9' }}>
                        <li>Keep phone line clear for the driver to call</li>
                        <li>Stay at your location if possible</li>
                        <li>Send someone to receive the ambulance</li>
                    </ul>
                </div>

                {/* OK Button */}
                <button onClick={onClose} style={{
                    width: '100%',
                    padding: '14px',
                    background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    letterSpacing: '0.5px',
                    transition: 'opacity 0.2s, transform 0.2s',
                    boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)'
                }}
                onMouseOver={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                    ✓ Got it, Thank you
                </button>
            </div>
        </div>
    );
}

function EmergencyForm() {
    const [formData, setFormData] = useState({
        patientName: '',
        contactNumber: '',
        emergencyType: '',
        pickupAddress: '',
        medicalNotes: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const [addressFetched, setAddressFetched] = useState('Fetching your live location...');
    const mapRef = useRef(null);
    const mapContainer = useRef(null);

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    setUserLocation([lat, lon]);
                    
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                        const data = await response.json();
                        if (data && data.display_name) {
                            setAddressFetched(data.display_name);
                            setFormData(prev => ({ ...prev, pickupAddress: data.display_name }));
                        } else {
                            setAddressFetched(`Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
                            setFormData(prev => ({ ...prev, pickupAddress: `${lat}, ${lon}` }));
                        }
                    } catch (err) {
                        setAddressFetched(`Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
                        setFormData(prev => ({ ...prev, pickupAddress: `${lat}, ${lon}` }));
                    }
                },
                (error) => {
                    console.error("Location error:", error);
                    setAddressFetched("Unable to get location. Please ensure location services are enabled.");
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            setAddressFetched("Geolocation is not supported by your browser.");
        }
        
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!mapContainer.current || !window.L || !userLocation) return;
        
        if (!mapRef.current) {
            mapRef.current = window.L.map(mapContainer.current, {
                zoomControl: true,
                dragging: false,
                scrollWheelZoom: false
            }).setView(userLocation, 15);

            window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapRef.current);

            const patientIcon = window.L.divIcon({
                className: 'custom-patient-icon',
                html: `
                  <div style="
                    background-color: #C62828; 
                    width: 16px; 
                    height: 16px; 
                    border-radius: 50%; 
                    border: 3px solid white;
                    box-shadow: 0 0 0 2px #C62828, 0 4px 10px rgba(0,0,0,0.3);
                  "></div>
                `,
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });

            window.L.marker(userLocation, { icon: patientIcon })
                .addTo(mapRef.current);
        } else {
            mapRef.current.setView(userLocation, 15);
        }
    }, [userLocation]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTimeout(() => {
            setIsSubmitting(false);
            setShowModal(true);
        }, 1500);
    };

    const handleModalClose = () => {
        setShowModal(false);
        setFormData({
            patientName: '',
            contactNumber: '',
            emergencyType: '',
            pickupAddress: addressFetched,
            medicalNotes: ''
        });
    };

    return (
        <div className="emergency-form-wrapper animate-slide-up">
            {showModal && <DispatchModal onClose={handleModalClose} />}
            <div className="emergency-form-container">
                <h2>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--emergency-red)" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Emergency Details
                </h2>
                <p>Please provide accurate information for immediate dispatch.</p>
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Patient Name *</label>
                    <input 
                        type="text" 
                        name="patientName"
                        className="form-control" 
                        placeholder="Full Name"
                        value={formData.patientName}
                        onChange={handleChange}
                        required 
                    />
                </div>

                <div className="form-group">
                    <label>Contact Number *</label>
                    <input 
                        type="tel" 
                        name="contactNumber"
                        className="form-control" 
                        placeholder="+91 XXXXX XXXXX"
                        value={formData.contactNumber}
                        onChange={handleChange}
                        required 
                    />
                </div>

                <div className="form-group">
                    <label>Emergency Type *</label>
                    <select 
                        name="emergencyType"
                        className="form-control"
                        value={formData.emergencyType}
                        onChange={handleChange}
                        required
                    >
                        <option value="" disabled>Select emergency condition</option>
                        <option value="Cardiac Arrest">Cardiac Arrest / Heart attack</option>
                        <option value="Trauma/Accident">Trauma / Road Accident</option>
                        <option value="Stroke">Stroke / Neurological</option>
                        <option value="Respiratory">Severe Breathing Difficulty</option>
                        <option value="Other">Other Medical Emergency</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Pickup Location (Auto-detected) *</label>
                    <div style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-std)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                        marginBottom: '12px'
                    }}>
                        {addressFetched}
                    </div>
                    <div 
                        ref={mapContainer} 
                        style={{ height: '200px', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-std)', backgroundColor: '#e2e8f0', zIndex: 1 }}
                    ></div>
                </div>

                <div className="form-group">
                    <label>Additional Medical Notes (Optional)</label>
                    <textarea 
                        name="medicalNotes"
                        className="form-control" 
                        placeholder="Current symptoms, known medical history, or allergies"
                        value={formData.medicalNotes}
                        onChange={handleChange}
                    />
                </div>

                <button 
                    type="submit" 
                    className="btn-emergency btn-submit-emergency"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        'DISPATCHING...'
                    ) : (
                        <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            DISPATCH AMBULANCE
                        </>
                    )}
                </button>
                </form>
            </div>
        </div>
    );
}

export default EmergencyForm;
