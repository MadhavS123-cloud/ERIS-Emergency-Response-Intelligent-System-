import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useEris } from '../context/ErisContext';
import './TrackPage.css';

const STATUS_STEPS = [
    { key: 'incoming', label: 'Request received' },
    { key: 'assigned', label: 'Driver assigned' },
    { key: 'en_route', label: 'Ambulance en route' },
    { key: 'arrived', label: 'Reached pickup' },
    { key: 'transporting', label: 'Going to hospital' },
    { key: 'completed', label: 'Arrived at hospital' },
];

const STATUS_COPY = {
    incoming: 'We have received your emergency request and are notifying nearby EMS units.',
    assigned: 'A driver has been assigned and is preparing to reach your pickup location.',
    en_route: 'Your ambulance is on the way. Please keep your phone nearby and be ready at the pickup point.',
    arrived: 'The ambulance has reached your location. The crew is assisting the patient now.',
    transporting: 'The patient is being taken to the hospital. The reception team is preparing intake.',
    completed: 'The ambulance has reached the hospital and reception handover is complete.',
};

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount || 0);

function TrackPage() {
    const { activeDispatch } = useEris();
    const mapRef = useRef(null);
    const mapContainerRef = useRef(null);
    const driverMarkerRef = useRef(null);
    const patientMarkerRef = useRef(null);
    const hospitalMarkerRef = useRef(null);
    const routeLineRef = useRef(null);
    const watchIdRef = useRef(null);

    const dispatch = activeDispatch;
    const currentIndex = Math.max(STATUS_STEPS.findIndex((step) => step.key === dispatch?.status), 0);

    useEffect(() => {
        if (!dispatch || !window.L || !mapContainerRef.current) {
            return undefined;
        }

        const fallbackDriverPosition = [12.9684, 77.6021];

        const getDestination = () => {
            if (dispatch.status === 'transporting' || dispatch.status === 'completed') {
                return dispatch.hospitalPosition;
            }

            return dispatch.patientPosition;
        };

        const renderMarkers = (driverPosition) => {
            if (!mapRef.current) {
                mapRef.current = window.L.map(mapContainerRef.current, { zoomControl: false }).setView(dispatch.patientPosition, 13);
                window.L.control.zoom({ position: 'topright' }).addTo(mapRef.current);

                window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '© OpenStreetMap contributors © CARTO'
                }).addTo(mapRef.current);
            }

            const ambulanceIcon = window.L.divIcon({
                className: 'track-ambulance-icon',
                html: `
                    <div style="background: white; border: 3px solid #2563eb; padding: 4px; border-radius: 999px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#2563eb" stroke="#2563eb" stroke-width="1.5"><path d="M10 17h.01"/><path d="M14 17h.01"/><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z"/><path d="M6 13V8l4-4h4l4 4v5"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg>
                    </div>
                `,
                iconSize: [38, 38],
                iconAnchor: [19, 19]
            });

            const patientIcon = window.L.divIcon({
                className: 'track-patient-icon',
                html: `
                    <div style="background: white; border: 3px solid #dc2626; padding: 4px; border-radius: 999px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" stroke-width="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                `,
                iconSize: [38, 38],
                iconAnchor: [19, 19]
            });

            const hospitalIcon = window.L.divIcon({
                className: 'track-hospital-icon',
                html: `
                    <div style="background: white; border: 3px solid #10b981; padding: 4px; border-radius: 999px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#10b981" stroke="#10b981" stroke-width="1.5"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/><path d="M13 9v.01"/><path d="M13 12v.01"/><path d="M13 15v.01"/><path d="M17 15v.01"/><path d="M17 18v.01"/></svg>
                    </div>
                `,
                iconSize: [38, 38],
                iconAnchor: [19, 19]
            });

            if (!driverMarkerRef.current) {
                driverMarkerRef.current = window.L.marker(driverPosition, { icon: ambulanceIcon }).addTo(mapRef.current);
                patientMarkerRef.current = window.L.marker(dispatch.patientPosition, { icon: patientIcon }).addTo(mapRef.current);
                hospitalMarkerRef.current = window.L.marker(dispatch.hospitalPosition, { icon: hospitalIcon }).addTo(mapRef.current);
            } else {
                driverMarkerRef.current.setLatLng(driverPosition);
                patientMarkerRef.current?.setLatLng(dispatch.patientPosition);
                hospitalMarkerRef.current?.setLatLng(dispatch.hospitalPosition);
            }

            const destination = getDestination();
            if (!routeLineRef.current) {
                routeLineRef.current = window.L.polyline([driverPosition, destination], {
                    color: '#2563eb',
                    weight: 4,
                    opacity: 0.85,
                    dashArray: '10, 10'
                }).addTo(mapRef.current);
            } else {
                routeLineRef.current.setLatLngs([driverPosition, destination]);
            }

            mapRef.current.fitBounds([driverPosition, dispatch.patientPosition, dispatch.hospitalPosition], {
                padding: [36, 36]
            });
        };

        const useFallbackLocation = () => renderMarkers(fallbackDriverPosition);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => renderMarkers([position.coords.latitude, position.coords.longitude]),
                useFallbackLocation,
                { enableHighAccuracy: true }
            );

            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => renderMarkers([position.coords.latitude, position.coords.longitude]),
                useFallbackLocation,
                { enableHighAccuracy: true }
            );
        } else {
            useFallbackLocation();
        }

        return () => {
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }

            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }

            driverMarkerRef.current = null;
            patientMarkerRef.current = null;
            hospitalMarkerRef.current = null;
            routeLineRef.current = null;
        };
    }, [dispatch]);

    if (!dispatch) {
        return (
            <div className="track-page-shell">
                <div className="track-empty-card">
                    <h1>No ambulance request is active</h1>
                    <p>Create an emergency booking first, then come back here to track the ambulance.</p>
                    <Link to="/patient" className="btn-emergency">Book Ambulance</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="track-page-shell">
            <header className="track-header">
                <div className="track-brand">
                    <Link to="/">
                        <img src="/image.png" alt="ERIS Logo" className="app-logo" style={{ height: '44px' }} />
                    </Link>
                    <div>
                        <div className="track-brand-title">Ambulance Tracking</div>
                        <div className="track-brand-subtitle">Patient view</div>
                    </div>
                </div>

                <div className="track-header-actions">
                    <Link to="/patient" className="track-secondary-link">New request</Link>
                    <Link to="/" className="track-secondary-link">Back home</Link>
                </div>
            </header>

            <main className="track-main">
                <section className="track-hero-card">
                    <div>
                        <div className="track-status-pill">{STATUS_STEPS[currentIndex]?.label || 'Request received'}</div>
                        <h1>{dispatch.patientName}, your ambulance request is active</h1>
                        <p>{STATUS_COPY[dispatch.status] || STATUS_COPY.incoming}</p>
                    </div>
                    <div className="track-hero-meta">
                        <div>
                            <span>Request ID</span>
                            <strong>{dispatch.requestId}</strong>
                        </div>
                        <div>
                            <span>ETA</span>
                            <strong>{dispatch.eta}</strong>
                        </div>
                        <div>
                            <span>Assigned Unit</span>
                            <strong>{dispatch.ambulanceId}</strong>
                        </div>
                    </div>
                </section>

                <section className="track-layout">
                    <div className="track-left-column">
                        <div className="track-card">
                            <div className="track-card-title">Live route overview</div>
                            <div ref={mapContainerRef} className="track-map"></div>
                        </div>

                        <div className="track-card">
                            <div className="track-card-title">Progress</div>
                            <div className="track-step-list">
                                {STATUS_STEPS.map((step, index) => {
                                    const stateClass = index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'pending';

                                    return (
                                        <div key={step.key} className={`track-step-item ${stateClass}`}>
                                            <div className="track-step-dot"></div>
                                            <div>
                                                <strong>{step.label}</strong>
                                                <div>{index <= currentIndex ? 'Updated in system' : 'Waiting'}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <aside className="track-right-column">
                        <div className="track-card">
                            <div className="track-card-title">Emergency details</div>
                            <div className="track-info-grid">
                                <div>
                                    <span>Emergency</span>
                                    <strong>{dispatch.emergencyType}</strong>
                                </div>
                                <div>
                                    <span>Priority</span>
                                    <strong>{dispatch.priority}</strong>
                                </div>
                                <div>
                                    <span>Pickup address</span>
                                    <strong>{dispatch.pickupAddress}</strong>
                                </div>
                                <div>
                                    <span>Contact</span>
                                    <strong>{dispatch.contactNumber}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="track-card reception-card">
                            <div className="track-card-title">Reception payment</div>
                            <div className="reception-amount">{formatCurrency(dispatch.estimatedCharge ?? 2500)}</div>
                            <p className="reception-copy">
                                Pay this ambulance charge at the hospital reception after handover. The staff portal will already have this request ID on file.
                            </p>
                            <div className="reception-meta">
                                <span>Receiving hospital</span>
                                <strong>{dispatch.hospitalName}</strong>
                            </div>
                        </div>

                        <div className="track-card">
                            <div className="track-card-title">Latest updates</div>
                            <div className="track-log-list">
                                {dispatch.logs.slice().reverse().map((log) => (
                                    <div key={log.id} className="track-log-item">
                                        <div className={`track-log-type ${log.type}`}>{log.type}</div>
                                        <div>
                                            <strong>{log.message}</strong>
                                            <div>{log.timestamp}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>
                </section>
            </main>
        </div>
    );
}

export default TrackPage;
