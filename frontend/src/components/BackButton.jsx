import React from 'react';
import { useNavigate } from 'react-router-dom';

const BackButton = () => {
  const navigate = useNavigate();

  return (
    <button 
      onClick={() => navigate(-1)} 
      style={{
        padding: '10px 15px', 
        marginBottom: '15px', 
        cursor: 'pointer',
        backgroundColor: '#3498db',
        color: 'white',
        border: 'none',
        borderRadius: '5px'
      }}
    >
      ⬅ Back
    </button>
  );
};

export default BackButton;
