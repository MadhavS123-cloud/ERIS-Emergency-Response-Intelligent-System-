import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime

# --- Page Config ---
st.set_page_config(
    page_title="⚡ ERIS COMMAND CENTER",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Custom CSS Injection ---
# Target exactly the styling parameters requested: Space Grotesk, glassmorphism, glowing cyan neon borders
custom_css = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

/* Global Reset & Background */
html, body, [class*="css"]  {
    font-family: 'Space Grotesk', sans-serif !important;
}

[data-testid="stAppViewContainer"] {
    background: radial-gradient(circle at top right, #0B1120, #030712 60%) !important;
    color: #e2e8f0 !important;
}

h1, h2, h3, h4, h5, h6, .stMarkdown p {
    color: #e2e8f0;
}
h1, h2, h3 {
    color: #f8fafc !important;
}

/* Sidebar Styling */
[data-testid="stSidebar"] {
    background: rgba(15,23,42,0.6) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border-right: 1px solid rgba(0, 240, 255, 0.15) !important;
}

/* Hide default streamlit branding / top header line */
[data-testid="stHeader"] {
    background: transparent !important;
}
footer {visibility: hidden;}

/* KPI Glass Cards */
.kpi-card {
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 240, 255, 0.15);
    border-top: 2px solid #00f0ff;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 1rem;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.kpi-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 20px rgba(0, 240, 255, 0.15);
}
.kpi-label {
    color: #94a3b8;
    font-size: 0.85rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 8px;
    font-weight: 600;
}
.kpi-value-container {
    display: flex;
    align-items: baseline;
    gap: 12px;
}
.kpi-value {
    color: #f8fafc;
    font-size: 2.5rem;
    font-weight: 700;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
    margin: 0;
    line-height: 1;
}
.kpi-delta {
    font-size: 0.9rem;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.2);
    white-space: nowrap;
}

/* Header Container */
.main-header-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    margin-top: -2rem; /* Pull up native streamlit spacing */
}
.header-title {
    font-size: 2.5rem;
    font-weight: 700;
    text-transform: uppercase;
    color: #f8fafc;
    margin: 0;
    line-height: 1.2;
}
.header-subtitle {
    color: #00f0ff;
    font-size: 1rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin: 0;
    margin-top: 4px;
}
.system-badge {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #10b981;
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.9rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    animation: badgePulse 2s infinite;
}
@keyframes badgePulse {
    0% { box-shadow: 0 0 5px rgba(16, 185, 129, 0.2); }
    50% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.6); }
    100% { box-shadow: 0 0 5px rgba(16, 185, 129, 0.2); }
}

/* Cyber Data Table */
.cyber-table-wrapper {
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 240, 255, 0.15);
    border-radius: 12px;
    padding: 1px;
    overflow-x: auto;
    margin-bottom: 1rem;
}
.cyber-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    color: #e2e8f0;
}
.cyber-table th {
    padding: 16px;
    color: #94a3b8;
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid rgba(0, 240, 255, 0.15);
    background: rgba(0,0,0,0.2);
}
.cyber-table td {
    padding: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 0.95rem;
}
.cyber-table tr:hover td {
    background: rgba(0, 240, 255, 0.05);
}
.cyber-table tr:last-child td {
    border-bottom: none;
}

/* Buttons */
.cyber-button {
    background: transparent;
    border: 1px solid #00f0ff;
    color: #00f0ff;
    padding: 12px 24px;
    font-family: inherit;
    font-weight: 600;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-block;
    text-decoration: none;
    text-align: center;
    width: 100%;
    margin-top: 1rem;
}
.cyber-button:hover {
    background: rgba(0, 240, 255, 0.1);
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
    transform: translateY(-2px);
    color: #f8fafc;
}

/* System Logs */
.log-card {
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(8px);
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    transition: all 0.2s ease;
    border: 1px solid rgba(255,255,255,0.05);
}
.log-card:hover {
    transform: translateX(4px);
    background: rgba(15, 23, 42, 0.7);
    border-color: rgba(255,255,255,0.1);
}
.log-card.red { border-left: 3px solid #ef4444; }
.log-card.blue { border-left: 3px solid #3b82f6; }
.log-card.amber { border-left: 3px solid #f59e0b; }
.log-card.green { border-left: 3px solid #10b981; }
.log-card.neutral { border-left: 3px solid #94a3b8; }

.log-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-right: 16px;
    width: 110px;
    text-align: center;
}
.log-badge.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
.log-badge.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
.log-badge.amber { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
.log-badge.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
.log-badge.neutral { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }

.log-message {
    color: #e2e8f0;
    font-size: 0.95rem;
    flex-grow: 1;
}
.log-time {
    color: #94a3b8;
    font-size: 0.85rem;
    font-family: monospace;
}

/* Sidebar Branding */
.sidebar-brand {
    font-size: 2rem;
    font-weight: 800;
    background: linear-gradient(90deg, #00f0ff, #3b82f6, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0;
    line-height: 1;
}
.sidebar-subtitle {
    color: #00f0ff;
    font-size: 0.8rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-top: 4px;
    margin-bottom: 24px;
    font-weight: 600;
}
.sidebar-divider {
    height: 1px;
    background: rgba(0, 240, 255, 0.2);
    margin: 16px 0;
}
.sidebar-status {
    color: #10b981;
    font-size: 0.85rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 600;
    text-align: center;
    margin-top: 16px;
    margin-bottom: 16px;
    text-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

/* Info Panel */
.info-panel {
    background: rgba(15, 23, 42, 0.4);
    border-left: 3px solid #3b82f6;
    padding: 16px;
    color: #94a3b8;
    font-family: monospace;
    font-size: 0.9rem;
}

/* Style Streamlit Tabs/Radio buttons in sidebar to look like links */
div[data-testid="stRadio"] label {
    font-family: 'Space Grotesk', sans-serif !important;
    font-size: 1.1rem !important;
    padding: 8px 0;
    color: #e2e8f0 !important;
}
div[data-testid="stRadio"] div[role="radiogroup"] > label > div:first-of-type {
    display: none; /* Hide standard radio circle */
}
</style>
"""

st.markdown(custom_css, unsafe_allow_html=True)

