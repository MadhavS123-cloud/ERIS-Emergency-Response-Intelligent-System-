import React, { useState } from 'react';
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
                pickupAddress: '',
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
                    <label>Pickup Location / Details *</label>
                    <textarea 
                        name="pickupAddress"
                        className="form-control" 
                        placeholder="Detailed address and landmarks for the driver"
                        value={formData.pickupAddress}
                        onChange={handleChange}
                        required 
                    />
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
