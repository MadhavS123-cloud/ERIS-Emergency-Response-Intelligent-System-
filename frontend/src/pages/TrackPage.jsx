import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEris } from '../context/ErisContext';
import API_BASE_URL from '../config/api';
import { addTomTomLayers } from '../config/tomtom';
import './TrackPage.css';

const STATUS_STEPS = [
    { key: 'incoming', label: 'Request received' },
    { key: 'assigned', label: 'Ambulance assigned' },
    { key: 'en_route', label: 'Ambulance headed to pickup' },
    { key: 'arrived', label: 'Ambulance arrived at pickup' },
    { key: 'in_transit', label: 'In transit to hospital' },
    { key: 'completed', label: 'Arrived at hospital' },
];

const STATUS_COPY = {
    incoming: 'We have received your emergency request. The hospital desk is assigning the nearest available ambulance now.',
    assigned: 'A hospital dispatcher has assigned an ambulance and driver. The unit is preparing to reach your pickup location.',
    en_route: 'Your ambulance is on the way. Please keep your phone nearby and be ready at the pickup point.',
    arrived: 'The ambulance has arrived at your location. Please board the vehicle.',
    in_transit: 'The ambulance is heading to the hospital with the patient.',
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
    const [guestDispatch, setGuestDispatch] = useState(null);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [phoneInput, setPhoneInput] = useState('');
    const [otpStep, setOtpStep] = useState(false);
    const [resolvedAddress, setResolvedAddress] = useState('');
    
    const urlId = new URLSearchParams(window.location.search).get('id');

    // Join the request-specific socket room for targeted ambulance location updates
    useEffect(() => {
        const requestId = activeDispatch?.id || urlId;
        if (!requestId) return;
        import('../socket').then(({ socket }) => {
            if (!socket.connected) socket.connect();
            socket.emit('join_request_room', requestId);
        });
    }, [activeDispatch?.id, urlId]);

    useEffect(() => {
        let interval;
        if (!activeDispatch && urlId) {
            const fetchGuestDispatch = () => {
                fetch(`${API_BASE_URL}/emergency/${urlId}`)
                    .then(r => r.json())
                    .then(res => {
                        if (res.status === 'success') {
                            const req = res.data;
                            const mapped = {
                                ...req,
                                requestId: req.id.slice(0, 8).toUpperCase(),
                                status: req.status === 'PENDING' ? 'incoming' : req.status === 'ACCEPTED' ? 'assigned' : req.status === 'EN_ROUTE' ? 'en_route' : req.status === 'ARRIVED' ? 'arrived' : req.status === 'IN_TRANSIT' ? 'in_transit' : 'completed',
                                patientName: req.patientName || 'Guest Patient',
                                contactNumber: req.patientPhone,
                                hospitalName: req.ambulance?.hospital?.name || 'Awaiting assignment',
                                driverName: req.driver?.name || req.ambulance?.driver?.name || 'Awaiting assignment',
                                driverPhone: req.driver?.phone || req.ambulance?.driver?.phone || 'Awaiting assignment',
                                vehicleNumber: req.ambulance?.plateNumber || 'Awaiting assignment',
                                pickupAddress: req.pickupAddress || null,
                                patientPosition: (req.locationLat && req.locationLng) ? [req.locationLat, req.locationLng] : null,
                                hospitalPosition: (req.ambulance?.hospital?.locationLat && req.ambulance?.hospital?.locationLng)
                                    ? [req.ambulance.hospital.locationLat, req.ambulance.hospital.locationLng]
                                    : null,
                                ambulancePosition: (req.ambulance?.locationLat && req.ambulance?.locationLng)
                                    ? [req.ambulance.locationLat, req.ambulance.locationLng]
                                    : null,
                                ambulanceInternalId: req.ambulance?.id || null,
                                priority: /cardiac|heart|stroke|panic|sos/i.test(req.emergencyType) ? 'CRITICAL' : 'HIGH',
                                eta: req.mlExpectedDelay ? `~${Math.round(req.mlExpectedDelay)} mins` : 'Awaiting dispatch',
                                estimatedCharge: 3000,
                                logs: [{ id: '1', message: 'Request triggered successfully.', type: 'system', timestamp: new Date(req.createdAt || Date.now()).toLocaleTimeString() }]
                            };
                            setGuestDispatch(prev => {
                                // Only show OTP modal if NO phone AND this is the first successful load
                                if (!req.patientPhone && !prev) {
                                    setShowOtpModal(true);
                                }
                                return mapped;
                            });
                        }
                    }).catch(console.error);
            };

            fetchGuestDispatch();
            interval = setInterval(fetchGuestDispatch, 3000); // Check every 3s since websockets won't work without auth
        }
        return () => {
             if (interval) clearInterval(interval);
        };
    }, [activeDispatch, urlId]);

    const dispatch = activeDispatch || guestDispatch;
    const currentIndex = Math.max(STATUS_STEPS.findIndex((step) => step.key === dispatch?.status), 0);

    // Reverse geocode if pickupAddress is missing or is the generic fallback
    useEffect(() => {
        const pos = dispatch?.patientPosition;
        const addr = dispatch?.pickupAddress;
        const needsGeocode = (!addr || addr === 'Unknown GPS Location') && pos?.[0] && pos?.[1];
        if (!needsGeocode) return;

        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos[0]}&lon=${pos[1]}&addressdetails=1`, {
            headers: { 'User-Agent': 'ERIS-Emergency-System' }
        })
            .then(r => r.json())
            .then(data => {
                if (data?.display_name) setResolvedAddress(data.display_name);
            })
            .catch(() => {});
    }, [dispatch?.id, dispatch?.patientPosition, dispatch?.pickupAddress]);

    const submitOtp = async () => {
        if (otpStep) {
            // Verify
            try {
                await fetch(`${API_BASE_URL}/emergency/otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId: dispatch.id, phone: phoneInput, otp: '1234' })
                });
                setShowOtpModal(false);
                setGuestDispatch({ ...dispatch, contactNumber: phoneInput });
            } catch (e) {
                console.error(e);
            }
        } else {
            console.log('OTP Mock Sent to '+phoneInput+': 1234');
            setOtpStep(true);
        }
    };

    const mapRef = useRef(null);
    const mapContainerRef = useRef(null);
    const driverMarkerRef = useRef(null);
    const patientMarkerRef = useRef(null);
    const hospitalMarkerRef = useRef(null);
    const routeLineRef = useRef(null);
    const watchIdRef = useRef(null);
    // Stable refs so map effects don't re-run on every dispatch update
    const dispatchIdRef = useRef(null);
    const patientPositionRef = useRef(null);
    const hospitalPositionRef = useRef(null);

    useEffect(() => {
        document.title = dispatch 
            ? `Track Case #${dispatch.requestId} | ERIS` 
            : "Ambulance Tracking | ERIS System";
    }, [dispatch?.requestId]);

    // Initialize map only once when dispatch first becomes available
    useEffect(() => {
        if (!dispatch || !window.L || !mapContainerRef.current) {
            return undefined;
        }
        // Already initialized for this dispatch — skip
        if (dispatchIdRef.current === dispatch.id && mapRef.current) {
            return undefined;
        }

        dispatchIdRef.current = dispatch.id;

        const patientPos = dispatch.patientPosition?.[0] && dispatch.patientPosition?.[1]
            ? dispatch.patientPosition
            : null;
        const hospitalPos = dispatch.hospitalPosition?.[0] && dispatch.hospitalPosition?.[1]
            ? dispatch.hospitalPosition
            : null;
        // Use real ambulance GPS from backend — NOT the patient's browser location
        const ambulancePos = dispatch.ambulancePosition?.[0] && dispatch.ambulancePosition?.[1]
            ? dispatch.ambulancePosition
            : null;

        if (!patientPos) return undefined; // Can't render without patient location

        patientPositionRef.current = patientPos;
        hospitalPositionRef.current = hospitalPos;

        const ambulanceIcon = window.L.divIcon({
            className: 'track-ambulance-icon',
            html: `<div style="background: white; border: 3px solid #2563eb; padding: 4px; border-radius: 999px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);"><svg width="22" height="22" viewBox="0 0 24 24" fill="#2563eb" stroke="#2563eb" stroke-width="1.5"><path d="M10 17h.01"/><path d="M14 17h.01"/><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z"/><path d="M6 13V8l4-4h4l4 4v5"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg></div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });

        const patientIcon = window.L.divIcon({
            className: 'track-patient-icon',
            html: `<div class="pulse-ring"></div><div class="pulse-dot"></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        const hospitalIcon = window.L.divIcon({
            className: 'track-hospital-icon',
            html: `<div style="background: white; border: 3px solid #10b981; padding: 4px; border-radius: 999px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);"><svg width="22" height="22" viewBox="0 0 24 24" fill="#10b981" stroke="#10b981" stroke-width="1.5"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/><path d="M13 9v.01"/><path d="M13 12v.01"/><path d="M13 15v.01"/><path d="M17 15v.01"/><path d="M17 18v.01"/></svg></div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });

        const initMap = () => {
            if (mapRef.current) return;

            mapRef.current = window.L.map(mapContainerRef.current, {
                zoomControl: false,
                scrollWheelZoom: false
            }).setView(patientPos, 13);
            window.L.control.zoom({ position: 'topright' }).addTo(mapRef.current);
            addTomTomLayers(mapRef.current, 'night', true, false);

            // Always place patient marker
            patientMarkerRef.current = window.L.marker(patientPos, { icon: patientIcon }).addTo(mapRef.current);

            // Place hospital marker only if we have real coordinates
            if (hospitalPos) {
                hospitalMarkerRef.current = window.L.marker(hospitalPos, { icon: hospitalIcon }).addTo(mapRef.current);
            }

            // Place ambulance marker only if driver has real GPS
            if (ambulancePos) {
                driverMarkerRef.current = window.L.marker(ambulancePos, { icon: ambulanceIcon }).addTo(mapRef.current);
                routeLineRef.current = window.L.polyline([ambulancePos, patientPos], {
                    color: '#2563eb', weight: 4, opacity: 0.85, dashArray: '10, 10'
                }).addTo(mapRef.current);
            }

            const boundsPoints = [patientPos];
            if (ambulancePos) boundsPoints.push(ambulancePos);
            if (hospitalPos) boundsPoints.push(hospitalPos);
            mapRef.current.fitBounds(boundsPoints, { padding: [36, 36] });
        };

        initMap();

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
            dispatchIdRef.current = null;
        };
    }, [dispatch?.id]); // Only re-init map when the dispatch ID changes

    // Update ambulance marker position when real-time location_update arrives
    useEffect(() => {
        if (!mapRef.current || !dispatch?.ambulancePosition) return;
        const [lat, lng] = dispatch.ambulancePosition;
        if (!lat || !lng) return;

        if (driverMarkerRef.current) {
            driverMarkerRef.current.setLatLng([lat, lng]);
        } else if (window.L) {
            // Ambulance just got GPS for the first time — add marker now
            const ambulanceIcon = window.L.divIcon({
                className: 'track-ambulance-icon',
                html: `<div style="background: white; border: 3px solid #2563eb; padding: 4px; border-radius: 999px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);"><svg width="22" height="22" viewBox="0 0 24 24" fill="#2563eb" stroke="#2563eb" stroke-width="1.5"><path d="M10 17h.01"/><path d="M14 17h.01"/><path d="M22 13h-4l-2-2H8l-2 2H2v7h20v-7Z"/><path d="M6 13V8l4-4h4l4 4v5"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg></div>`,
                iconSize: [38, 38], iconAnchor: [19, 19]
            });
            driverMarkerRef.current = window.L.marker([lat, lng], { icon: ambulanceIcon }).addTo(mapRef.current);
        }

        if (patientPositionRef.current) {
            if (routeLineRef.current) {
                routeLineRef.current.setLatLngs([[lat, lng], patientPositionRef.current]);
            } else if (window.L) {
                routeLineRef.current = window.L.polyline([[lat, lng], patientPositionRef.current], {
                    color: '#2563eb', weight: 4, opacity: 0.85, dashArray: '10, 10'
                }).addTo(mapRef.current);
            }
        }
    }, [dispatch?.ambulancePosition]);

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
                            <span>Driver Name</span>
                            <strong>{dispatch.driverName}</strong>
                        </div>
                        <div>
                            <span>Vehicle / Driver Contact</span>
                            <strong>{dispatch.vehicleNumber} | {dispatch.driverPhone}</strong>
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
                                    <strong>{dispatch.emergencyType || 'General Emergency'}</strong>
                                </div>
                                <div>
                                    <span>Priority</span>
                                    <strong>{dispatch.priority || 'HIGH'}</strong>
                                </div>
                                <div>
                                    <span>Pickup address</span>
                                    <strong>
                                        {dispatch.pickupAddress && dispatch.pickupAddress !== 'Unknown GPS Location'
                                            ? dispatch.pickupAddress
                                            : resolvedAddress || (dispatch.patientPosition?.[0]
                                                ? `${dispatch.patientPosition[0].toFixed(5)}, ${dispatch.patientPosition[1].toFixed(5)}`
                                                : 'Locating...')}
                                    </strong>
                                </div>
                                <div>
                                    <span>Contact</span>
                                    <strong>{dispatch.contactNumber || 'Not provided'}</strong>
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
            {showOtpModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h2 style={{marginTop: 0}}>Help us reach you</h2>
                        <p style={{color: '#64748b'}}>Your ambulance is already being dispatched! Please enter your phone number so the driver can contact you (Optional).</p>
                        
                        <input 
                            type="tel" 
                            placeholder="Phone Number" 
                            style={{width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box'}} 
                            value={phoneInput} 
                            onChange={(e) => setPhoneInput(e.target.value)}
                            disabled={otpStep}
                        />

                        {otpStep && (
                            <input 
                                type="text" 
                                placeholder="Enter OTP (Mock: 1234)" 
                                style={{width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box'}} 
                            />
                        )}

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button onClick={() => setShowOtpModal(false)} style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>Skip</button>
                            <button onClick={submitOtp} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                                {otpStep ? 'Verify OTP' : 'Send OTP'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TrackPage;
