import streamlit as st

def load_css():
    """Apply premium custom CSS for smooth transitions and modern aesthetics."""
    st.markdown("""
        <style>
        /* 1. Global smooth fade-in for the entire app */
        @keyframes fadeIn {
            from { opacity: 0.85; transform: translateY(2px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .main .block-container {
            animation: fadeIn 0.4s ease-out;
        }

        /* 2. Remove the annoying Streamlit "dimming" overlay during refresh */
        div[data-testid="stStatusWidget"] {
            visibility: hidden;
            height: 0;
        }
        
        /* 3. The "Heartbeat" Live Sync Indicator */
        @keyframes heartbeat {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 10px rgba(0, 255, 0, 0.6); }
            100% { transform: scale(1); opacity: 0.8; }
        }
        .sync-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            background-color: #00ff00;
            border-radius: 50%;
            margin-right: 8px;
            animation: heartbeat 2s infinite ease-in-out;
        }

        /* 4. Modern Metric Styling */
        div[data-testid="metric-container"] {
            background: linear-gradient(135deg, rgba(28, 131, 225, 0.05) 0%, rgba(28, 131, 225, 0.15) 100%);
            border: 1px solid rgba(28, 131, 225, 0.2);
            padding: 1rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            transition: transform 0.2s;
        }
        div[data-testid="metric-container"]:hover {
            transform: translateY(-2px);
            border-color: rgba(28, 131, 225, 0.4);
        }

        /* 5. Custom Scrollbar for premium feel */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        ::-webkit-scrollbar-thumb { background: rgba(28, 131, 225, 0.3); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(28, 131, 225, 0.5); }

        /* 6. Fix for wide layout padding */
        .block-container {
            padding-top: 1.5rem;
            max-width: 95%;
        }
        </style>
    """, unsafe_allow_html=True)
