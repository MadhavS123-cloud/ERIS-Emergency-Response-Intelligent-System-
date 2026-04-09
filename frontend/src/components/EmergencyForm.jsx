import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useEris } from '../context/ErisContext';
import './EmergencyForm.css';

function EmergencyForm() {
    const { submitEmergencyRequest } = useEris();
    const [formData, setFormData] = useState({
        patientName: '',
        patientEmail: '',
        contactNumber: '',
        emergencyType: '',
        pickupAddress: '',
        medicalNotes: '',
        locationLat: null,
        locationLng: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedDispatch, setSubmittedDispatch] = useState(null);
    const [showPopup, setShowPopup] = useState(false);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationError, setLocationError] = useState('');
    const locationFetchedRef = useRef(false);

    useEffect(() => {
        if (submittedDispatch) {
            setShowPopup(true);
            const timer = setTimeout(() => setShowPopup(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [submittedDispatch]);

    const formatCurrency = (amount) =>
        new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount || 0);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'contactNumber') {
            const numbersOnly = value.replace(/\D/g, '');
            if (numbersOnly.length <= 10) {
                setFormData(prev => ({ ...prev, [name]: numbersOnly }));
            }
            return;
        }

        if (name === 'patientName') {
            if (value.length <= 50) {
                setFormData(prev => ({ ...prev, [name]: value }));
            }
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Automatic location detection on component mount
    useEffect(() => {
        if (!locationFetchedRef.current && !formData.pickupAddress) {
            locationFetchedRef.current = true;
            getCurrentLocationAddress();
        }
    }, []);

    const getCurrentLocationAddress = async () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            return;
        }

        setIsGettingLocation(true);
        setLocationError('');

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            const { latitude, longitude } = position.coords;
            
            // Reverse geocoding to get address
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'ERIS-Emergency-System'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch address');
            }

            const data = await response.json();
            
            if (data && data.display_name) {
                // Format the address to be more readable
                const formattedAddress = formatAddress(data);
                setFormData(prev => ({ 
                    ...prev, 
                    pickupAddress: formattedAddress,
                    locationLat: latitude,
                    locationLng: longitude
                }));
            } else {
                // Fallback to coordinates if no address found
                setFormData(prev => ({ 
                    ...prev, 
                    pickupAddress: `Current Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                    locationLat: latitude,
                    locationLng: longitude
                }));
            }
        } catch (error) {
            console.error('Location error:', error);
            setLocationError('Unable to get your location. Please enter address manually.');
            // Set a default placeholder message
            setFormData(prev => ({ 
                ...prev, 
                pickupAddress: '' 
            }));
        } finally {
            setIsGettingLocation(false);
        }
    };

    const formatAddress = (data) => {
        const address = data.address || {};
        const parts = [];
        
        // Build address components in order of preference
        if (address.house_number) parts.push(address.house_number);
        if (address.road) parts.push(address.road);
        if (address.neighbourhood) parts.push(address.neighbourhood);
        if (address.suburb) parts.push(address.suburb);
        
        // Add city/town
        if (address.city || address.town || address.village) {
            parts.push(address.city || address.town || address.village);
        }
        
        // Add state and postcode
        if (address.state) parts.push(address.state);
        if (address.postcode) parts.push(address.postcode);
        
        // If we couldn't build a proper address, use the display_name
        if (parts.length === 0) {
            return data.display_name;
        }
        
        return parts.join(', ');
    };

    const handleLocationRefresh = () => {
        locationFetchedRef.current = false;
        getCurrentLocationAddress();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Block submission if we don't have real GPS coordinates
        if (!formData.locationLat || !formData.locationLng) {
            alert('Your location could not be detected. Please allow location access and click "Refresh Location" before submitting.');
            return;
        }

        setIsSubmitting(true);

            const newDispatch = await submitEmergencyRequest(formData);
            if (newDispatch) {
                setSubmittedDispatch(newDispatch);
                setFormData({
                    patientName: '',
                    patientEmail: '',
                    contactNumber: '',
                    emergencyType: '',
                    pickupAddress: '',
                    medicalNotes: '',
                    locationLat: null,
                    locationLng: null
                });
                window.scrollTo(0, 0);
            } else {
                alert('Failed to dispatch emergency request. Please try again.');
            }
            setIsSubmitting(false);
    };

    if (submittedDispatch) {
        return (
            <div className="emergency-form-wrapper animate-slide-up">
                {showPopup && (
                    <div className="toast-popup">
                        <span className="toast-icon">🚑</span>
                        Ambulance is getting ready...
                        <button className="toast-close" onClick={() => setShowPopup(false)}>×</button>
                    </div>
                )}
                <div className="emergency-form-container dispatch-confirmation-card">
                    <div className="dispatch-confirmation-badge">Dispatch Confirmed</div>
                    <h2>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success-green)" strokeWidth="2.5">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        Help is on the way
                    </h2>
                    <p>
                        Your request has been routed to dispatch and shared with the driver and hospital consoles.
                        Stay near the pickup point and keep your phone available.
                    </p>

                    <div className="dispatch-summary-grid">
                        <div className="dispatch-summary-card">
                            <span>Request ID</span>
                            <strong>{submittedDispatch.requestId}</strong>
                        </div>
                        <div className="dispatch-summary-card">
                            <span>Priority</span>
                            <strong>{submittedDispatch.priority}</strong>
                        </div>
                        <div className="dispatch-summary-card">
                            <span>Estimated Arrival</span>
                            <strong>{submittedDispatch.eta}</strong>
                        </div>
                        <div className="dispatch-summary-card">
                            <span>Receiving Hospital</span>
                            <strong>{submittedDispatch.hospitalName}</strong>
                        </div>
                        <div className="dispatch-summary-card">
                            <span>Reception Payment</span>
                            <strong>{formatCurrency(submittedDispatch.estimatedCharge)}</strong>
                        </div>
                    </div>

                    <div className="dispatch-note">
                        <div className="dispatch-note-title">What happens next</div>
                        <div className="dispatch-note-body">
                            The hospital emergency desk will assign an ambulance and driver, then the assigned unit will navigate to your pickup location.
                        </div>
                    </div>

                    <div className="dispatch-confirmation-actions">
                        <Link to="/track" className="btn-secondary dispatch-action-link">
                            Track Ambulance
                        </Link>
                        <Link to="/" className="dispatch-outline-link">
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

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
                            placeholder="Full Name (Max 50 characters)"
                            value={formData.patientName}
                            onChange={handleChange}
                            maxLength="50"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Contact Number *</label>
                        <input
                            type="tel"
                            name="contactNumber"
                            className="form-control"
                            placeholder="10-digit mobile number"
                            value={formData.contactNumber}
                            onChange={handleChange}
                            pattern="[0-9]{10}"
                            title="Please enter a valid 10-digit mobile number"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            name="patientEmail"
                            className="form-control"
                            placeholder="Optional email for future account linking"
                            value={formData.patientEmail}
                            onChange={handleChange}
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
                        <label>
                            Pickup Location / Details *
                            <button
                                type="button"
                                onClick={handleLocationRefresh}
                                disabled={isGettingLocation}
                                style={{
                                    marginLeft: '12px',
                                    padding: '4px 8px',
                                    fontSize: 'var(--text-xs)',
                                    background: 'var(--dept-blue-light)',
                                    color: 'var(--dept-blue)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: isGettingLocation ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="23 4 23 10 17 10"/>
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                </svg>
                                {isGettingLocation ? 'Getting Location...' : 'Refresh Location'}
                            </button>
                        </label>
                        {isGettingLocation && (
                            <div style={{
                                padding: '12px',
                                background: 'var(--dept-blue-light)',
                                color: 'var(--dept-blue)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--text-sm)',
                                marginBottom: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <div className="live-dot" style={{ width: '6px', height: '6px' }}></div>
                                Detecting your current location...
                            </div>
                        )}
                        {locationError && (
                            <div style={{
                                padding: '12px',
                                background: 'var(--emergency-red-light)',
                                color: 'var(--emergency-red)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--text-sm)',
                                marginBottom: '8px'
                            }}>
                                {locationError}
                            </div>
                        )}
                        <textarea
                            name="pickupAddress"
                            className="form-control"
                            placeholder={isGettingLocation ? "Detecting your location..." : "Detailed address and landmarks for the driver (auto-detected)"}
                            value={formData.pickupAddress}
                            onChange={handleChange}
                            required
                            disabled={isGettingLocation}
                            style={{
                                background: isGettingLocation ? 'var(--bg-glass)' : 'var(--bg-main)',
                                cursor: isGettingLocation ? 'not-allowed' : 'text'
                            }}
                        />
                        {!isGettingLocation && formData.pickupAddress && (
                            <div style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-secondary)',
                                marginTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                                Location auto-detected. You can edit if needed.
                            </div>
                        )}
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
