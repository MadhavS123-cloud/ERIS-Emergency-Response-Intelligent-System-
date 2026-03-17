import React from 'react';
import { useNavigate } from 'react-router-dom';

const FloatingBookButton = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/patient');
  };

  return (
    <button 
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '15px 20px',
        backgroundColor: '#e74c3c',
        color: 'white',
        border: 'none',
        borderRadius: '50px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        zIndex: 1000,
        transition: 'transform 0.2s'
      }}
      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      🚑 Book Ambulance
    </button>
  );
};

export default FloatingBookButton;
