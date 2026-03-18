import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEris } from '../context/ErisContext';
import './EmergencyForm.css';

function EmergencyForm() {
    const { submitEmergencyRequest } = useEris();
    const [formData, setFormData] = useState({
        patientName: '',
        contactNumber: '',
        emergencyType: '',
        pickupAddress: '',
        medicalNotes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedDispatch, setSubmittedDispatch] = useState(null);

    const formatCurrency = (amount) =>
        new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount || 0);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        setTimeout(() => {
            const newDispatch = submitEmergencyRequest(formData);
            setSubmittedDispatch(newDispatch);
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

    if (submittedDispatch) {
        return (
            <div className="emergency-form-wrapper animate-slide-up">
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
                            The nearest EMS unit will accept the case, proceed to your location, and coordinate handover with the hospital emergency desk.
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

                    <button
                        type="button"
                        className="dispatch-reset-btn"
                        onClick={() => setSubmittedDispatch(null)}
                    >
                        Submit Another Emergency
                    </button>
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
