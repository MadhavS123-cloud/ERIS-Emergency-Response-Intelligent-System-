import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './LoginPage.css';

function LoginPage() {
    const navigate = useNavigate();
    const [role, setRole] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSignIn = (e) => {
        e.preventDefault();
        // Redirect based on selected role
        if (role === 'hospital') {
            navigate('/hospital');
        } else if (role === 'driver') {
            navigate('/driver');
        } else {
            alert('Please select a valid role to continue.');
        }
    };

    return (
        <div className="login-page-container">
            {/* Back to Home Link */}
            <Link to="/" className="back-to-home">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Back to Home
            </Link>

            {/* Header / Logo */}
            <div className="login-header">
                <div className="login-logo-box">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                        <path d="M10 17h.01" /><path d="M14 17h.01" /><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z" /><path d="M6 13V8l4-4h4l4 4v5" /><circle cx="7" cy="17" r="1" /><circle cx="17" cy="17" r="1" />
                        <path stroke="white" strokeWidth="2" d="M12 9v6m-3-3h6" />
                    </svg>
                </div>
                <div className="login-brand-name">ERIS</div>
                <div className="login-subtitle">Staff Login Portal</div>
            </div>

            {/* Login Card */}
            <div className="login-card">
                <h2>Sign In</h2>
                <p>Access your dashboard</p>

                <form onSubmit={handleSignIn}>
                    <div className="form-group">
                        <label>Role *</label>
                        <div className="input-wrapper select-wrapper">
                            <select
                                className="form-control"
                                style={{ paddingLeft: '14px', color: role ? '#0f172a' : '#94a3b8' }}
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                required
                            >
                                <option value="" disabled hidden>Select your role</option>
                                <option value="hospital" style={{ color: '#0f172a' }}>Hospital Admin</option>
                                <option value="driver" style={{ color: '#0f172a' }}>Ambulance Driver</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Username *</label>
                        <div className="input-wrapper">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Password *</label>
                        <div className="input-wrapper">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <input
                                type="password"
                                className="form-control"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-options">
                        <label className="remember-me">
                            <input type="checkbox" /> Remember me
                        </label>
                        <a href="#forgot" className="forgot-password">Forgot password?</a>
                    </div>

                    <button type="submit" className="btn-signin">Sign In</button>
                </form>
            </div>
        </div>
    );
}

export default LoginPage;
