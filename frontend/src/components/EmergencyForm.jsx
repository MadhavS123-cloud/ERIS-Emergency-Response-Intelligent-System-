import React, { useState, useEffect, useRef } from 'react';
import './EmergencyForm.css';

function EmergencyForm() {
    const [formData, setFormData] = useState({
        patientName: '',
        contactNumber: '',
        emergencyType: '',
        pickupAddress: '',
        medicalNotes: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
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
        // Simulate API call for dispatch
        setTimeout(() => {
            alert('Emergency Ambulance Dispatched successfully to your location. Please stay calm and wait for help.');
            setIsSubmitting(false);
            setFormData({
                patientName: '',
                contactNumber: '',
                emergencyType: '',
                pickupAddress: addressFetched,
                medicalNotes: ''
            });
        }, 1500);
    };

    return (
        <div className="emergency-form-wrapper animate-slide-up">
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
