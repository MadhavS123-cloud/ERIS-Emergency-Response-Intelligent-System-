import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useEris } from '../context/ErisContext';
import { CircleLoader } from 'react-spinners';
import './HomePage.css';

/**
 * Professional Landing Page for ERIS
 * Designed for immediate emergency access and official dispatch protocols.
 */
function HomePage() {
    const mapRef = useRef(null);
    const mapContainer = useRef(null);
    const { activeDispatch, resetDemoState } = useEris();



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

    // Intersection Observer for Lazy Animations
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    // Unobserve after the animation triggers
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

        const timeout = setTimeout(() => {
            const lazyElements = document.querySelectorAll('.lazy-fade-in, .lazy-slide-up');
            lazyElements.forEach(el => observer.observe(el));
        }, 100);

        return () => {
            clearTimeout(timeout);
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        document.title = "ERIS | Fast Emergency Response System";
    }, []);

    // ScrollSpy for Active Links
    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY;
            if (scrollY < 200) {
                setActiveSection('');
                return;
            }
            const sections = ['how', 'hospitals'];
            let currentStr = '';
            for (const section of sections) {
                const el = document.getElementById(section);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top <= 150 && rect.bottom >= 150) {
                        currentStr = section;
                    }
                }
            }
            setActiveSection(currentStr);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
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

            window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors & CARTO',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(mapRef.current);

            // Add accurate user location marker
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
                .addTo(mapRef.current)
                .bindPopup('<strong style="color:#C62828">Your Actual Location</strong>')
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
                    background-color: white; 
                    border: 3px solid #0D47A1; 
                    color: #0D47A1; 
                    width: 32px; 
                    height: 32px; 
                    border-radius: 50%; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-weight: 900;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                    font-family: sans-serif;
                    font-size: 16px;
                  ">H</div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            hospitals.forEach(h => {
                const marker = window.L.marker(h.coords, { icon: hospitalIcon })
                    .addTo(mapRef.current)
                    .bindPopup(`
                    <div style="font-family: sans-serif; padding: 4px;">
                      <strong style="color: #0D47A1; font-size: 14px;">${h.name}</strong><br/>
                      <span style="color: ${h.status === 'ER Ready' ? '#C62828' : '#d97706'}; font-weight: 800; font-size: 12px; text-transform: uppercase;">STATUS: ${h.status}</span>
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
        <div className="landing-page" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
            {/* Header */}
            <header className="home-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center' }}>
                        <img src="/image.png" alt="ERIS Logo" className="app-logo home-logo-img" style={{ height: '48px' }} />
                    </Link>
                </div>

                <nav className={`home-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                    <a href="#how" className={activeSection === 'how' ? 'active-link' : ''}>How It Works</a>
                    <a href="#hospitals" className={activeSection === 'hospitals' ? 'active-link' : ''}>Facilities</a>
                    {isPatientSession ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '600', fontSize: 'var(--text-sm)', background: 'var(--bg-card)', padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-std)' }}>
                                <span className="live-dot" style={{ background: 'var(--success-green)' }}></span>
                                Welcome, <span style={{ textTransform: 'capitalize' }}>{activeDispatch.patientName.split(' ')[0]}</span>
                            </div>
                            <button onClick={resetDemoState} className="btn-nav-login" style={{ background: 'transparent', color: 'var(--emergency-red)', border: '1px solid var(--emergency-red)', cursor: 'pointer' }}>
                                Logout
                            </button>
                        </div>
                    ) : (
                        <Link to="/login" className="btn-nav-login">
                            Staff Login
                        </Link>
                    )}
                </nav>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a href="tel:112" className="nav-helpline">
                        <div className="nav-helpline-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                        </div>
                        <div className="nav-helpline-text">
                            <span style={{ fontSize: '10px', fontWeight: '800', opacity: 0.8, letterSpacing: '0.05em' }}>EMERGENCY</span>
                            <span style={{ fontSize: '18px', fontWeight: '900', lineHeight: 1 }}>112</span>
                        </div>
                    </a>

                    <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        {mobileMenuOpen ? '✕' : '☰'}
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <main className="hero-section lazy-fade-in">
                <div className="hero-text lazy-slide-up">
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--emergency-red-light)',
                        color: 'var(--emergency-red-dark)',
                        padding: '6px 16px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: '700',
                        marginBottom: '32px',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <span className="live-dot" style={{ width: '6px', height: '6px' }}></span>
                        24/7 EMERGENCY DISPATCH
                    </div>

                    {isPatientSession ? (
                        <div className="active-booking-hero" style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-std)', boxShadow: 'var(--shadow-lg)', marginBottom: '40px', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <h2 style={{ fontSize: 'var(--text-2xl)', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Active Emergency Booking</h2>
                                <span style={{ background: 'var(--emergency-red-light)', color: 'var(--emergency-red)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', fontWeight: '800', letterSpacing: '0.05em' }}>
                                    {activeDispatch.status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Assigned EMS Unit</div>
                                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: '800', color: 'var(--text-primary)' }}>{activeDispatch.ambulanceId}</div>
                                </div>
                                <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Estimated Arrival</div>
                                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: '800', color: 'var(--dept-blue)' }}>{activeDispatch.eta}</div>
                                </div>
                                <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Destination Facility</div>
                                    <div style={{ fontSize: 'var(--text-base)', fontWeight: '700', color: 'var(--text-primary)' }}>{activeDispatch.hospitalName}</div>
                                </div>
                            </div>

                            <Link to="/track" className="btn-emergency" style={{ display: 'flex', justifyContent: 'center', padding: '16px', textDecoration: 'none' }}>
                                Track Ambulance Live
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h1 className="hero-title">
                                Fast Emergency Response When Every Second Counts
                            </h1>

                            <p style={{ fontSize: 'var(--text-xl)', color: 'var(--text-secondary)', marginBottom: '48px', lineHeight: '1.6', fontWeight: '400' }}>
                                Get immediate ambulance assistance with real-time tracking and intelligent routing to the nearest prepared hospital.
                            </p>

                            <div className="hero-buttons">
                                <Link to="/patient" className="btn-emergency" style={{
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '16px 36px',
                                    fontSize: 'var(--text-base)'
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    Book Emergency Ambulance
                                </Link>

                                <Link to="/track" className="btn-secondary" style={{
                                    textDecoration: 'none',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-std)',
                                    boxShadow: 'var(--shadow-sm)',
                                    padding: '16px 36px',
                                    fontSize: 'var(--text-base)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                    Track Ambulance
                                </Link>
                            </div>
                        </>
                    )}


                </div>

                <div className="lazy-fade-in hero-image-wrapper">
                    <img
                        src="/erisimg.jpeg"
                        alt="ERIS Ambulance Dispatch"
                        style={{
                            width: '100%',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                            position: 'relative',
                            zIndex: 1,
                            border: '1px solid var(--border-std)',
                            objectFit: 'cover',
                            aspectRatio: '16/9'
                        }}
                    />
                </div>
            </main>

            {/* How It Works Section */}
            <section id="how" className="section-padding lazy-fade-in" style={{ padding: '100px 40px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-std)' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
                    <div className="stats-grid">
                        <div>
                            <div style={{ fontSize: 'var(--text-5xl)', fontWeight: '900', color: 'var(--dept-blue)', lineHeight: 1 }}>5<span style={{ fontSize: 'var(--text-2xl)' }}>min</span></div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '12px', fontWeight: '500' }}>Avg Response Time</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--text-5xl)', fontWeight: '900', color: 'var(--dept-blue)', lineHeight: 1 }}>24<span style={{ fontSize: 'var(--text-2xl)' }}>/7</span></div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '12px', fontWeight: '500' }}>Always Available</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--text-5xl)', fontWeight: '900', color: 'var(--dept-blue)', lineHeight: 1 }}>150<span style={{ fontSize: 'var(--text-2xl)' }}>+</span></div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '12px', fontWeight: '500' }}>Ambulances Ready</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--text-5xl)', fontWeight: '900', color: 'var(--dept-blue)', lineHeight: 1 }}>50<span style={{ fontSize: 'var(--text-2xl)' }}>+</span></div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '12px', fontWeight: '500' }}>Partner Hospitals</div>
                        </div>
                    </div>

                    <h2 style={{ fontSize: 'var(--text-4xl)', color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.02em' }}>How ERIS Works</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '64px', fontSize: 'var(--text-lg)', maxWidth: '600px', margin: '0 auto 64px' }}>Simple, reliable emergency response in 3 steps</p>

                    <div className="steps-grid">
                        <div className="card-std" style={{ padding: '40px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ background: 'var(--dept-blue-light)', width: '56px', height: '56px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dept-blue)', marginBottom: '32px' }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                            </div>
                            <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: '16px', color: 'var(--text-primary)' }}>1. Request Ambulance</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: '1.6', flex: 1 }}>Fill in basic details and your location. Our system instantly finds the nearest available ambulance using smart routing.</p>
                        </div>
                        <div className="card-std" style={{ padding: '40px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ background: 'var(--dept-blue-light)', width: '56px', height: '56px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dept-blue)', marginBottom: '32px' }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                            </div>
                            <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: '16px', color: 'var(--text-primary)' }}>2. Track in Real-Time</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: '1.6', flex: 1 }}>See your ambulance's live location and estimated arrival time. Stay informed every step of the way on a map.</p>
                        </div>
                        <div className="card-std" style={{ padding: '40px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ background: 'var(--dept-blue-light)', width: '56px', height: '56px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dept-blue)', marginBottom: '32px' }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                            </div>
                            <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: '16px', color: 'var(--text-primary)' }}>3. Get Treatment</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: '1.6', flex: 1 }}>We route you to the best available hospital actively equipped to handle your specific emergency.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Dynamic Real-Time Hospitals Section */}
            <section id="hospitals" className="section-padding lazy-fade-in" style={{ padding: '100px 40px', background: 'var(--bg-main)' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                        <div>
                            <h2 className="hospitals-header-title" style={{ fontSize: 'var(--text-4xl)', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Real-Time Nearby Hospitals</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)' }}>Live view of facilities around your actual GPS location</p>
                        </div>
                    </div>

                    <div className="hospitals-grid">
                        {/* Left side: Fetched Hospital List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {loadingHospitals ? (
                                <div style={{ padding: '60px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--dept-blue)', fontWeight: '600', gap: '24px' }}>
                                    <img src="/image.png" alt="Loading ERIS Data" className="app-logo" style={{ height: '64px', animation: 'logoPulse 2s infinite ease-in-out' }} />
                                    <span style={{ animation: 'pulseText 2s infinite ease-in-out', letterSpacing: '0.02em' }}>Establishing secure connection to ERIS network...</span>
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
                                                        fontSize: 'var(--text-xs)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontWeight: '800'
                                                    }}>{hospital.status}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: '12px' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                                    {calculateDistance(userLocation, hospital.coords)} km away
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hospital.status === 'ER Ready' ? 'var(--success-green)' : 'var(--warning-orange)', fontSize: 'var(--text-sm)', marginBottom: '16px', fontWeight: '600' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                                    Available beds: {hospital.beds} General
                                                </div>
                                                {/* Insurance Section */}
                                                <div style={{ marginBottom: '16px' }}>
                                                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px' }}>Accepted Insurance</div>
                                                    {hospital.insurance && hospital.insurance.length > 0 ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                                            {hospital.insurance.slice(0, 3).map((ins, i) => (
                                                                <span key={i} style={{
                                                                    background: '#F3F4F6',
                                                                    color: '#374151',
                                                                    fontSize: '12px',
                                                                    fontWeight: '600',
                                                                    padding: '4px 10px',
                                                                    borderRadius: '999px',
                                                                    whiteSpace: 'nowrap'
                                                                }}>{ins}</span>
                                                            ))}
                                                            {hospital.insurance.length > 3 && (
                                                                <span style={{
                                                                    fontSize: '12px',
                                                                    fontWeight: '600',
                                                                    color: '#6B7280',
                                                                    padding: '4px 6px'
                                                                }}>+{hospital.insurance.length - 3} more</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>No insurance info available</span>
                                                    )}
                                                </div>
                                                <button
                                                    disabled={isDisabled}
                                                    onClick={() => {
                                                        if (!isDisabled) {
                                                            setSelectedHospitalId(isSelected ? null : hospital.id);
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '13px',
                                                        marginTop: '0',
                                                        background: btnBg,
                                                        borderRadius: '8px',
                                                        fontWeight: '700',
                                                        fontSize: 'var(--text-sm)',
                                                        color: btnColor,
                                                        border: btnBorder,
                                                        cursor: btnCursor,
                                                        transition: 'background 0.15s ease, color 0.15s ease',
                                                        letterSpacing: '0.02em'
                                                    }}
                                                >{btnText}</button>
                                            </div>
                                        );
                                    })}

                                    {/* View More button */}
                                    {hospitals.length > 3 && !showAllHospitals && (
                                        <button
                                            onClick={() => setShowAllHospitals(true)}
                                            style={{
                                                width: '100%',
                                                padding: '16px',
                                                background: 'var(--bg-card)',
                                                border: '1px solid var(--border-std)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-primary)',
                                                fontSize: 'var(--text-sm)',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                visibility: 'visible',
                                                opacity: 1
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" />
                                                <polyline points="12 6 12 12 16 14" />
                                            </svg>
                                            View {hospitals.length - 3} More Hospitals
                                        </button>
                                    )}

                                    {/* Show Less button */}
                                    {showAllHospitals && (
                                        <button
                                            onClick={() => setShowAllHospitals(false)}
                                            style={{
                                                width: '100%',
                                                padding: '16px',
                                                background: 'var(--bg-card)',
                                                border: '1px solid var(--border-std)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-primary)',
                                                fontSize: 'var(--text-sm)',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" />
                                                <polyline points="12 6 12 12 8 14" />
                                            </svg>
                                            Show Less
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--emergency-red)', fontWeight: '600', background: 'var(--emergency-red-light)', borderRadius: 'var(--radius-md)' }}>
                                    No hospitals found within 8km of your location.
                                </div>
                            )}
                        </div>

                        {/* Right side: Live Leaflet Map */}
                        <div
                            className="card-std"
                            style={{ padding: '0', overflow: 'hidden', minHeight: '500px', display: 'flex', flexDirection: 'column' }}
                        >
                            <div style={{ background: 'var(--text-primary)', color: 'white', padding: '16px 20px', fontSize: 'var(--text-xs)', fontWeight: '700', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span className="live-dot" style={{ background: 'var(--success-green)' }}></span> LIVE GPS TRACKING</span>
                                {userLocation && <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>LAT: {userLocation[0].toFixed(4)} LON: {userLocation[1].toFixed(4)}</span>}
                            </div>
                            <div ref={mapContainer} style={{ flex: 1, width: '100%', backgroundColor: '#e2e8f0' }}></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Banner */}
            <section className="lazy-fade-in" style={{
                background: 'linear-gradient(135deg, var(--emergency-red) 0%, var(--emergency-red-dark) 100%)',
                padding: '80px 40px',
                color: 'white',
                textAlign: 'center',
                boxShadow: 'inset 0 10px 30px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ fontSize: 'var(--text-4xl)', marginBottom: '16px', color: 'white', letterSpacing: '-0.02em' }}>Need Emergency Help Right Now?</h2>
                <p style={{ fontSize: 'var(--text-xl)', opacity: 0.9, marginBottom: '40px' }}>Don't wait. Every second matters in an emergency.</p>
                <Link to="/patient" style={{
                    background: 'white',
                    color: 'var(--emergency-red)',
                    padding: '18px 40px',
                    borderRadius: 'var(--radius-full)',
                    textDecoration: 'none',
                    fontWeight: '800',
                    fontSize: 'var(--text-lg)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    transition: 'transform var(--transition-fast)'
                }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Book Ambulance Now
                </Link>
            </section>

            <footer className="footer-text" style={{
                height: '80px',
                background: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                fontSize: 'var(--text-xs)',
                color: 'rgba(255,255,255,0.7)',
                fontWeight: '600',
                letterSpacing: '0.05em'
            }}>
                <img src="/image.png" alt="ERIS Footer Logo" className="app-logo" style={{ height: '28px', opacity: 0.5, filter: 'grayscale(100%) brightness(2)' }} />
                <span>© 2026 ERIS NATIONAL EMERGENCY DISPATCH SYSTEM | AUTHORIZED PERSONNEL ONLY</span>
            </footer>
        </div>
    );
}

export default HomePage;
