import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEris } from '../context/ErisContext';
import { CircleLoader } from 'react-spinners';
import { addTomTomLayers } from '../config/tomtom';
import authService from '../services/authService';
import './HomePage.css';

/**
 * Professional Landing Page for ERIS
 * Designed for immediate emergency access and official dispatch protocols.
 */
function HomePage() {
    const mapRef = useRef(null);
    const mapContainer = useRef(null);
    const { activeDispatch, resetDemoState } = useEris();
    const navigate = useNavigate();
    const user = authService.getUser();
    const token = authService.getToken();

    // Redirect staff to their dashboards when they land on home
    useEffect(() => {
        if (token && user?.role === 'DRIVER') {
            navigate('/driver', { replace: true });
        } else if (token && (user?.role === 'ADMIN' || user?.role === 'HOSPITAL')) {
            navigate('/hospital', { replace: true });
        }
    }, [token, user, navigate]);


    // State for live location and fetched hospitals
    const [userLocation, setUserLocation] = useState(null);
    const [hospitals, setHospitals] = useState([]);
    const [loadingHospitals, setLoadingHospitals] = useState(true);
    const [showAllHospitals, setShowAllHospitals] = useState(false);
    const [selectedHospitalId, setSelectedHospitalId] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('');
    const markersRef = useRef([]);

    // Determine if the current active dispatch belongs to an actual user session (not a pre-seeded demo dispatch)
    const isPatientSession = activeDispatch && !activeDispatch.id.startsWith('dispatch-seed-');

    useEffect(() => {
        document.title = "ERIS | Fast Emergency Response System";
    }, []);

    // ScrollSpy for Active Links — throttled with requestAnimationFrame
    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const scrollY = window.scrollY;
                if (scrollY < 200) {
                    setActiveSection('');
                    ticking = false;
                    return;
                }
                const sections = ['how', 'hospitals'];
                let currentStr = '';
                for (const section of sections) {
                    const el = document.getElementById(section);
                    if (el) {
                        const top = el.offsetTop - 150;
                        const bottom = top + el.offsetHeight;
                        if (scrollY >= top && scrollY < bottom) {
                            currentStr = section;
                        }
                    }
                }
                setActiveSection(currentStr);
                ticking = false;
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // 1. Get User Location (Browser Geolocation API)
    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation([position.coords.latitude, position.coords.longitude]);
                },
                (error) => {
                    console.error("Location error:", error);
                    // Fallback to Whitefield, Bangalore
                    setUserLocation([12.9785, 77.7262]);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            // Fallback to Whitefield, Bangalore
            setUserLocation([12.9785, 77.7262]);
        }

        // Cleanup Leaflet instance on unmount
        return () => {
            if (mapRef.current) {
                mapRef.current._resizeObserver?.disconnect();
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // 2. Fetch Live Hospitals via Overpass API
    useEffect(() => {
        if (!userLocation) return;

        const fetchHospitals = async () => {
            setLoadingHospitals(true);
            const [lat, lng] = userLocation;
            // Overpass API Query for hospitals within a 15km radius
            const query = `
                [out:json];
                (
                  node["amenity"="hospital"](around:15000, ${lat}, ${lng});
                  way["amenity"="hospital"](around:15000, ${lat}, ${lng});
                );
                out center;
            `;
            try {
                const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
                const data = await response.json();

                // Parse, map, and add mock status/beds
                let parsedHospitals = data.elements
                    .filter(el => el.tags && el.tags.name) // name is required
                    .map(el => {
                        const latCoord = el.lat || el.center?.lat;
                        const lonCoord = el.lon || el.center?.lon;

                        // Distance calculation for sorting (haversine approx)
                        const latDiff = latCoord - lat;
                        const lonDiff = lonCoord - lng;
                        const distSq = latDiff * latDiff + lonDiff * lonDiff;

                        // Mock insurance pool for demo
                        const insurancePool = ['Ayushman Bharat', 'HDFC Ergo', 'ICICI Lombard', 'Star Health', 'Bajaj Allianz', 'Niva Bupa', 'Care Health'];
                        const shuffled = insurancePool.sort(() => 0.5 - Math.random());
                        const insuranceCount = Math.floor(Math.random() * 4) + 1; // 1–4 providers

                        return {
                            id: el.id,
                            name: el.tags.name,
                            coords: [latCoord, lonCoord],
                            distSq: distSq,
                            // Assign mock statuses to make the dashboard look active
                            status: Math.random() > 0.4 ? 'ER Ready' : 'Limited',
                            beds: Math.floor(Math.random() * 40) + 10,
                            insurance: shuffled.slice(0, insuranceCount)
                        };
                    });

                if (parsedHospitals.length > 0) {
                    // Sort by distance first, then by bed availability (higher beds first)
                    parsedHospitals.sort((a, b) => {
                        // First sort by distance (nearest first)
                        if (a.distSq !== b.distSq) {
                            return a.distSq - b.distSq;
                        }
                        // Then sort by bed availability (more beds first)
                        return b.beds - a.beds;
                    });

                    // Specific hospital promotion logic to ensure prominent hospitals show up in UI if they exist in range
                    const preferredNames = ["sathya sai", "vydehi", "apollo", "manipal"];
                    parsedHospitals.sort((a, b) => {
                        const aPref = preferredNames.some(p => a.name.toLowerCase().includes(p)) ? -1 : 0;
                        const bPref = preferredNames.some(p => b.name.toLowerCase().includes(p)) ? -1 : 0;
                        return (aPref - bPref) || (a.distSq - b.distSq) || (b.beds - a.beds);
                    });

                    // Show all nearby hospitals
                    setHospitals(parsedHospitals);
                } else {
                    throw new Error("No hospitals found in API response.");
                }
            } catch (err) {
                console.error("Failed to fetch hospitals, using fallbacks:", err);
                setHospitals([
                    { id: 101, name: 'Sri Sathya Sai Super Speciality Hospital', coords: [12.9785, 77.7262], status: 'ER Ready', beds: 48, insurance: ['Ayushman Bharat', 'Star Health', 'HDFC Ergo'] },
                    { id: 102, name: 'Vydehi Institute of Medical Sciences', coords: [12.9760, 77.7215], status: 'ER Ready', beds: 120, insurance: ['Ayushman Bharat', 'ICICI Lombard', 'Bajaj Allianz', 'Niva Bupa', 'Care Health'] },
                    { id: 103, name: 'Apollo Hospitals Whitefield', coords: [12.9647, 77.7176], status: 'Limited', beds: 5, insurance: ['HDFC Ergo', 'Star Health'] },
                    { id: 104, name: 'Columbia Asia Hospital', coords: [12.9694, 77.7497], status: 'ER Ready', beds: 35, insurance: ['Care Health', 'ICICI Lombard'] },
                    { id: 105, name: 'Manipal Hospital Whitefield', coords: [12.9796, 77.7379], status: 'ER Ready', beds: 28, insurance: ['Ayushman Bharat', 'HDFC Ergo', 'Star Health'] },
                    { id: 106, name: 'Fortis Hospital Bannerghatta', coords: [12.9136, 77.6098], status: 'Limited', beds: 15, insurance: ['Bajaj Allianz', 'Niva Bupa'] },
                    { id: 107, name: 'Narayana Health City', coords: [12.9270, 77.6808], status: 'ER Ready', beds: 85, insurance: ['Care Health', 'Star Health', 'HDFC Ergo'] }
                ]);
            } finally {
                setLoadingHospitals(false);
            }
        };

        fetchHospitals();
    }, [userLocation]);

    // 3. Initialize Map & Render Dynamic Markers
    useEffect(() => {
        if (!mapContainer.current || !window.L || !userLocation) return;

        // Init map if it doesn't exist
        if (!mapRef.current) {
            mapRef.current = window.L.map(mapContainer.current, {
                zoomControl: false, // Professional look
                scrollWheelZoom: false // Prevent accidental zoom on scroll
            }).setView(userLocation, 13);

            addTomTomLayers(mapRef.current, 'main', true, false);

            // Force Leaflet to recalculate container size after render
            setTimeout(() => mapRef.current?.invalidateSize(), 100);

            // Re-invalidate on any container resize (handles scroll-into-view)
            if (window.ResizeObserver) {
                const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
                ro.observe(mapContainer.current);
                mapRef.current._resizeObserver = ro;
            }

            // Add accurate user location marker
            const patientIcon = window.L.divIcon({
                className: 'custom-patient-icon',
                html: `
                  <div style="
                    background-color: #dc2626;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    border: 2px solid #0a0e17;
                  "></div>
                `,
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });
            window.L.marker(userLocation, { icon: patientIcon })
                .addTo(mapRef.current)
                .bindPopup('<strong style="color:#fca5a5;font-weight:500">Your location</strong>')
                .openPopup();
        } else {
            // Recenter if location updates
            mapRef.current.setView(userLocation, 13);
        }

        // Draw fetched hospital markers
        if (hospitals.length > 0 && mapRef.current) {
            // Clear old markers to avoid duplicates
            markersRef.current.forEach(m => m.remove());
            markersRef.current = [];

            const hospitalIcon = window.L.divIcon({
                className: 'custom-hospital-icon',
                html: `
                  <div style="
                    background-color: #111827;
                    border: 0.5px solid rgba(255,255,255,0.18);
                    color: #93c5fd;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 500;
                    font-family: system-ui, sans-serif;
                    font-size: 12px;
                  ">H</div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            hospitals.forEach(h => {
                const marker = window.L.marker(h.coords, { icon: hospitalIcon })
                    .addTo(mapRef.current)
                    .bindPopup(`
                    <div style="font-family: system-ui,sans-serif;padding:4px;">
                      <strong style="color:#e2e8f0;font-size:12px;font-weight:500">${h.name}</strong><br/>
                      <span style="color:${h.status === 'ER Ready' ? '#fca5a5' : '#fcd34d'};font-weight:500;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;">${h.status}</span>
                    </div>
                  `);
                markersRef.current.push(marker);
            });
        }
    }, [userLocation, hospitals]);

    // Distance Calculation Utility (Haversine formula in Km)
    const calculateDistance = (coords1, coords2) => {
        if (!coords1 || !coords2) return "0.0";
        const [lat1, lon1] = coords1;
        const [lat2, lon2] = coords2;
        const R = 6371; // Earth Radius in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(1);
    };

    return (
        <div className="landing-page">
            {/* ── HEADER ─────────────────────────────────────────────── */}
            <header className="home-header">
                <Link to="/" className="home-brand-link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <img src="/image.png" alt="ERIS" className="eris-shield" />
                    <span className="home-brand-text">ERIS</span>
                    <span className="home-brand-sub">Emergency Response System</span>
                </Link>

                {/* Desktop nav */}
                <nav className="home-nav">
                    <a href="#how" className={activeSection === 'how' ? 'active-link' : ''}>How It Works</a>
                    <a href="#hospitals" className={activeSection === 'hospitals' ? 'active-link' : ''}>Facilities</a>
                </nav>

                {/* Right cluster */}
                <div className="home-header-right">
                    {isPatientSession ? (
                        <div className="home-patient-actions">
                            <Link to="/track" className="btn-nav-track">
                                <span className="live-dot" style={{ width: '6px', height: '6px' }} />
                                Track Request
                            </Link>
                            <button type="button" onClick={resetDemoState} className="btn-nav-logout">
                                Logout
                            </button>
                        </div>
                    ) : (
                        <Link to="/login" className="btn-nav-login">Staff Login</Link>
                    )}

                    {/* Hamburger — mobile only */}
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen
                            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/></svg>
                        }
                    </button>
                </div>
            </header>

            {/* ── MOBILE MENU DRAWER ─────────────────────────────────── */}
            {mobileMenuOpen && (
                <div className="mobile-nav-drawer" onClick={() => setMobileMenuOpen(false)}>
                    <div className="mobile-nav-inner" onClick={e => e.stopPropagation()}>
                        <div className="mobile-nav-header">
                            <div className="mobile-nav-brand">
                                <img src="/image.png" alt="ERIS" className="eris-shield" style={{ height: '28px' }} />
                                <span className="home-brand-text" style={{ fontSize: '15px' }}>ERIS</span>
                            </div>
                            <button className="mobile-nav-close" onClick={() => setMobileMenuOpen(false)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <nav className="mobile-nav-links">
                            <a href="#how" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">How It Works</a>
                            <a href="#hospitals" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">Nearby Facilities</a>
                        </nav>

                        <div className="mobile-nav-actions">
                            {isPatientSession ? (
                                <>
                                    <Link to="/track" className="mobile-nav-cta-btn" onClick={() => setMobileMenuOpen(false)}>
                                        <span className="live-dot" style={{ width: '7px', height: '7px' }} />
                                        Track My Ambulance
                                    </Link>
                                    <button className="mobile-nav-secondary-btn" onClick={() => { resetDemoState(); setMobileMenuOpen(false); }}>
                                        Logout / End Session
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/patient" className="mobile-nav-cta-btn" onClick={() => setMobileMenuOpen(false)}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        Book Emergency Ambulance
                                    </Link>
                                </>
                            )}
                        </div>

                        <div className="mobile-nav-helpline">
                            <Link to="/login" className="mobile-nav-helpline-link" onClick={() => setMobileMenuOpen(false)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 600, opacity: 0.7, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Authorized Access</div>
                                    <div style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1 }}>Staff Login</div>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero Section */}
            <main className="hero-section">
                <div className="hero-text">
                    <div className="home-hero-eyebrow">
                        <span className="live-dot" />
                        24 / 7 Emergency Dispatch
                    </div>

                    {isPatientSession ? (
                        <div className="home-active-booking">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '8px' }}>
                                <h2>Active emergency booking</h2>
                                <span className="badge badge-red">
                                    {activeDispatch.status === 'completed' ? 'Completed' : 'In progress'}
                                </span>
                            </div>
                            <div className="home-active-meta">
                                <div className="home-active-cell">
                                    <div className="home-active-cell-label">Assigned EMS unit</div>
                                    <div className="home-active-cell-value">{activeDispatch.ambulanceId}</div>
                                </div>
                                <div className="home-active-cell">
                                    <div className="home-active-cell-label">Estimated arrival</div>
                                    <div className="home-active-cell-value home-active-cell-value--accent">{activeDispatch.eta}</div>
                                </div>
                                <div className="home-active-cell home-active-cell--full">
                                    <div className="home-active-cell-label">Destination facility</div>
                                    <div className="home-active-cell-value">{activeDispatch.hospitalName}</div>
                                </div>
                            </div>
                            <Link to="/track" className="btn-emergency" style={{ display: 'inline-flex', justifyContent: 'center', textDecoration: 'none', width: '100%' }}>
                                Track ambulance live
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h1 className="hero-title">
                                Fast Emergency Response When Every Second Counts
                            </h1>
                            <p className="home-hero-lead">
                                Get immediate ambulance assistance with real-time tracking and intelligent routing to the nearest prepared hospital.
                            </p>
                            <div className="hero-buttons">
                                <Link to="/patient" className="btn-emergency" style={{ textDecoration: 'none' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    Book Emergency Ambulance
                                </Link>
                                <Link to="/track" className="btn-secondary" style={{ textDecoration: 'none' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                    Track Ambulance
                                </Link>
                            </div>
                            <div className="hero-trust-bar">
                                <div className="hero-trust-item">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    Avg. 5 min response
                                </div>
                                <div className="hero-trust-divider" />
                                <div className="hero-trust-item">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    GPS auto-detected
                                </div>
                                <div className="hero-trust-divider" />
                                <div className="hero-trust-item">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                    Nearest hospital routed
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Hero right — Live Dispatch Activity Panel */}
                <div className="hero-activity-panel">
                    <div className="hap-header">
                        <span className="hap-title">
                            <span className="live-dot" />
                            Live Dispatch Activity
                        </span>
                        <span className="hap-badge">BENGALURU</span>
                    </div>

                    <div className="hap-metric-row">
                        <div className="hap-metric">
                            <div className="hap-metric-value hap-red">3</div>
                            <div className="hap-metric-label">Active Emergencies</div>
                        </div>
                        <div className="hap-metric">
                            <div className="hap-metric-value hap-green">12</div>
                            <div className="hap-metric-label">Units Available</div>
                        </div>
                        <div className="hap-metric">
                            <div className="hap-metric-value hap-blue">~5m</div>
                            <div className="hap-metric-label">Avg Response</div>
                        </div>
                    </div>

                    <div className="hap-divider" />

                    <div className="hap-feed-title">Recent dispatches</div>
                    <div className="hap-feed">
                        <div className="hap-feed-item">
                            <div className="hap-feed-dot hap-green" />
                            <div className="hap-feed-info">
                                <div className="hap-feed-type">Cardiac Arrest</div>
                                <div className="hap-feed-meta">Apollo Hospitals · 4 min ago</div>
                            </div>
                            <div className="hap-feed-status">EN ROUTE</div>
                        </div>
                        <div className="hap-feed-item">
                            <div className="hap-feed-dot hap-blue" />
                            <div className="hap-feed-info">
                                <div className="hap-feed-type">Road Accident</div>
                                <div className="hap-feed-meta">Manipal Hospital · 7 min ago</div>
                            </div>
                            <div className="hap-feed-status">ARRIVED</div>
                        </div>
                        <div className="hap-feed-item">
                            <div className="hap-feed-dot hap-amber" />
                            <div className="hap-feed-info">
                                <div className="hap-feed-type">Respiratory Distress</div>
                                <div className="hap-feed-meta">Fortis Bannerghatta · 11 min ago</div>
                            </div>
                            <div className="hap-feed-status">ASSIGNED</div>
                        </div>
                        <div className="hap-feed-item">
                            <div className="hap-feed-dot hap-green" />
                            <div className="hap-feed-info">
                                <div className="hap-feed-type">Stroke</div>
                                <div className="hap-feed-meta">Narayana Health City · 15 min ago</div>
                            </div>
                            <div className="hap-feed-status">IN TRANSIT</div>
                        </div>
                    </div>

                    <div className="hap-divider" />

                    <div className="hap-footer">
                        <div className="hap-footer-item">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            Whitefield · Indiranagar · Koramangala
                        </div>
                        <div className="hap-footer-item">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Updated just now
                        </div>
                    </div>
                </div>
            </main>

            {/* How It Works Section */}
            <section id="how" className="section-padding home-section-how">
                <div className="section-inner">
                    <div className="stats-grid">
                        <div className="home-stat-item">
                            <div className="home-stat-value">40%</div>
                            <div className="home-stat-label">Faster Response</div>
                            <p className="home-stat-desc">Target reduction in average emergency response time</p>
                        </div>
                        <div className="home-stat-item">
                            <div className="home-stat-value">100%</div>
                            <div className="home-stat-label">Real-Time Visibility</div>
                            <p className="home-stat-desc">Complete tracking from request to hospital handoff</p>
                        </div>
                        <div className="home-stat-item">
                            <div className="home-stat-value">2000+</div>
                            <div className="home-stat-label">Verified Hospitals</div>
                            <p className="home-stat-desc">Direct system integration with major healthcare networks</p>
                        </div>
                        <div className="home-stat-item">
                            <div className="home-stat-value">7500+</div>
                            <div className="home-stat-label">Fleet Units</div>
                            <p className="home-stat-desc">Active emergency ambulances with live GPS telemetrics</p>
                        </div>
                    </div>

                    <div className="section-header">
                        <h2 className="home-section-title">How ERIS works</h2>
                        <p className="home-section-lead">Simple, reliable emergency response in three steps.</p>
                    </div>

                    <div className="steps-grid">
                        <div className="home-step-card">
                            <div className="home-step-num">Step 01</div>
                            <div className="home-step-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                            </div>
                            <h3 className="home-step-title">Request ambulance</h3>
                            <p className="home-step-body">Fill in basic details and your location. Our system finds the nearest available ambulance using smart routing.</p>
                        </div>
                        <div className="home-step-card">
                            <div className="home-step-num">Step 02</div>
                            <div className="home-step-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                            </div>
                            <h3 className="home-step-title">Track live</h3>
                            <p className="home-step-body">See live location and ETA. Stay informed every step on the map with real-time GPS tracking.</p>
                        </div>
                        <div className="home-step-card">
                            <div className="home-step-num">Step 03</div>
                            <div className="home-step-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                            </div>
                            <h3 className="home-step-title">Get treatment</h3>
                            <p className="home-step-body">We route you to the best available hospital fully equipped for your emergency type.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Dynamic Real-Time Hospitals Section */}
            <section id="hospitals" className="section-padding home-section-hospitals">
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div className="hospitals-section-header">
                        <div>
                            <h2 className="hospitals-header-title">Real-time nearby hospitals</h2>
                            <p className="home-section-lead" style={{ marginBottom: 0 }}>Live view of facilities around your GPS location.</p>
                        </div>
                    </div>

                    <div className="hospitals-grid">
                        {/* Left side: Fetched Hospital List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {loadingHospitals ? (
                                <div className="home-hospitals-loading">
                                    <div className="eris-loader">
                                        <div className="eris-loader-inner" />
                                    </div>
                                    <span className="home-hospitals-loading-text">Scanning hospital network…</span>
                                </div>
                            ) : hospitals.length > 0 ? (
                                <>
                                    {/* Show top 3 hospitals */}
                                    {hospitals.slice(0, showAllHospitals ? hospitals.length : 3).map((hospital, idx) => {
                                        const isSelected = selectedHospitalId === hospital.id;
                                        const isUnavailable = hospital.beds === 0;
                                        const isDisabled = isUnavailable || (selectedHospitalId !== null && !isSelected);

                                        let btnText = 'Choose Facility';
                                        let btnBg = '#2563EB';
                                        let btnColor = 'white';
                                        let btnBorder = 'none';
                                        let btnCursor = 'pointer';

                                        if (isSelected) {
                                            btnText = 'Selected ✓';
                                            btnBg = '#1d4ed8';
                                        } else if (isUnavailable) {
                                            btnText = 'Not Available';
                                            btnBg = '#e2e8f0';
                                            btnColor = '#94a3b8';
                                            btnCursor = 'not-allowed';
                                        } else if (selectedHospitalId !== null) {
                                            btnBg = '#e2e8f0';
                                            btnColor = '#94a3b8';
                                            btnCursor = 'not-allowed';
                                        }

                                        return (
                                            <div key={hospital.id || idx} className="card-std" style={{
                                                padding: '24px',
                                                border: isSelected ? '2px solid #2563EB' : '1px solid var(--border-std)',
                                                transition: 'border-color 0.15s ease'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                    <h3 style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{hospital.name}</h3>
                                                    <span style={{
                                                        background: hospital.status === 'ER Ready' ? 'var(--emergency-red-light)' : 'rgba(245, 158, 11, 0.1)',
                                                        color: hospital.status === 'ER Ready' ? 'var(--emergency-red)' : 'var(--warning-orange)',
                                                        fontSize: 'var(--text-xs)', padding: '2px 7px', borderRadius: 'var(--radius-sm)', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase'
                                                    }}>{hospital.status}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: '12px' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                                    {calculateDistance(userLocation, hospital.coords)} km away
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hospital.status === 'ER Ready' ? 'var(--green-text)' : 'var(--amber-text)', fontSize: '11px', marginBottom: '12px', fontWeight: '500', fontVariantNumeric: 'tabular-nums' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                                    Available beds: {hospital.beds} General
                                                </div>
                                                {/* Insurance Section */}
                                                <div style={{ marginBottom: '16px' }}>
                                                    <div style={{ fontSize: '9px', fontWeight: '500', color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Accepted insurance</div>
                                                    {hospital.insurance && hospital.insurance.length > 0 ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                                            {hospital.insurance.slice(0, 3).map((ins, i) => (
                                                                <span key={i} style={{
                                                                    background: 'var(--bg-elevated)',
                                                                    color: 'var(--text-secondary)',
                                                                    fontSize: '11px',
                                                                    fontWeight: '500',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '4px',
                                                                    whiteSpace: 'nowrap',
                                                                    border: '0.5px solid var(--border-subtle)'
                                                                }}>{ins}</span>
                                                            ))}
                                                            {hospital.insurance.length > 3 && (
                                                                <span style={{
                                                                    fontSize: '11px',
                                                                    fontWeight: '500',
                                                                    color: 'var(--text-muted)',
                                                                    padding: '2px 6px'
                                                                }}>+{hospital.insurance.length - 3} more</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>No insurance info available</span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
                                                    <button
                                                        disabled={isDisabled}
                                                        onClick={() => {
                                                            if (!isDisabled) {
                                                                setSelectedHospitalId(isSelected ? null : hospital.id);
                                                            }
                                                        }}
                                                        className={`hospital-action-btn${isSelected ? ' hospital-action-btn--selected' : ''}${isDisabled ? ' hospital-action-btn--disabled' : ''}`}
                                                        style={{
                                                            background: btnBg,
                                                            color: btnColor,
                                                            cursor: btnCursor
                                                        }}
                                                    >{btnText}</button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* View More button */}
                                    {hospitals.length > 3 && !showAllHospitals && (
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <button
                                                onClick={() => setShowAllHospitals(true)}
                                                className="hospitals-toggle-btn"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <polyline points="12 8 12 16" />
                                                    <polyline points="8 12 16 12" />
                                                </svg>
                                                View {hospitals.length - 3} More Hospitals
                                            </button>
                                        </div>
                                    )}

                                    {/* Show Less button */}
                                    {showAllHospitals && (
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <button
                                                onClick={() => setShowAllHospitals(false)}
                                                className="hospitals-toggle-btn"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <polyline points="8 12 16 12" />
                                                </svg>
                                                Show Less
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--emergency-red)', fontWeight: '600', background: 'var(--emergency-red-light)', borderRadius: 'var(--radius-md)' }}>
                                    No hospitals found within 8km of your location.
                                </div>
                            )}
                        </div>

                        {/* Right side: TomTom Live Map */}
                        <div
                            className="card-std"
                            style={{ padding: '0', overflow: 'hidden', minHeight: '500px', display: 'flex', flexDirection: 'column' }}
                        >
                            <div className="map-chrome-bar">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span className="live-dot" /> Live GPS</span>
                                {userLocation && (
                                    <span className="map-chrome-coords">
                                        LAT {userLocation[0].toFixed(4)} · LON {userLocation[1].toFixed(4)}
                                    </span>
                                )}
                            </div>
                            <div ref={mapContainer} style={{ flex: 1, width: '100%', minHeight: '460px', backgroundColor: '#1a2744' }}></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Banner */}
            <section className="home-cta-banner">
                <h2 className="home-cta-title">Need emergency help right now?</h2>
                <p className="home-cta-desc">Do not wait. Every second matters in an emergency.</p>
                <Link to="/patient" className="home-cta-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Book ambulance now
                </Link>
            </section>

            <footer className="home-footer">
                <img src="/image.png" alt="ERIS" className="eris-shield" />
                <span>© 2026 ERIS · National emergency dispatch · Authorized access</span>
            </footer>
        </div>
    );
}

export default HomePage;
