import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function FloatingBookButton() {
  const [isVisible, setIsVisible] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Only apply hiding logic on the HomePage where main CTAs live
    if (location.pathname !== '/') {
      setIsVisible(false); // Do not show floating CTA on internal pages
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // If any of the tracked CTAs are intersecting (visible), hide the floating button
        const anyVisible = entries.some(entry => entry.isIntersecting);
        setIsVisible(!anyVisible);
      },
      {
        root: null,
        // Trigger as soon as 10% of the target CTA is visible
        threshold: 0.1, 
      }
    );

    // Target the main CTAs on the homepage that should hide the floating button when visible
    const heroBtn = document.querySelector('.hero-section .btn-emergency');
    const footerBtn = document.querySelector('section:last-of-type .btn-emergency');

    if (heroBtn) observer.observe(heroBtn);
    if (footerBtn) observer.observe(footerBtn);

    return () => {
      observer.disconnect();
    };
  }, [location.pathname]);

  if (!isVisible) return null;

  return (
    <Link
      to="/patient"
      className="btn-emergency animate-fade-in"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '16px 24px',
        textDecoration: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        fontSize: 'var(--text-sm)'
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      Book Ambulance
    </Link>
  );
}

export default FloatingBookButton;
