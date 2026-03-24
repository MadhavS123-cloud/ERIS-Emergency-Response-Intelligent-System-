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

# --- Sidebar UI ---
with st.sidebar:
    st.markdown("<div class='sidebar-brand'>⚡ ERIS</div>", unsafe_allow_html=True)
    st.markdown("<div class='sidebar-subtitle'>COMMAND CENTER</div>", unsafe_allow_html=True)
    st.markdown("<div class='sidebar-divider'></div>", unsafe_allow_html=True)
    
    # Navigation
    nav_selection = st.radio(
        "",
        ["Overview", "Fleet Operations", "Node Management", "Analytics Core", "System Logs"],
        label_visibility="collapsed"
    )
    
    # Large Vertical Gap simulated
    for _ in range(12):
        st.write("")
        
    st.markdown("<div class='sidebar-divider'></div>", unsafe_allow_html=True)
    st.markdown("<div class='sidebar-status'>STATUS: OPTIMAL</div>", unsafe_allow_html=True)
    st.markdown("<button class='cyber-button'>TERMINATE SESSION</button>", unsafe_allow_html=True)


# --- Reusable Components ---
def kpi_card(label, value, delta=None):
    delta_html = f"<div class='kpi-delta'>{delta}</div>" if delta else ""
    html = f"""
    <div class="kpi-card">
        <div class="kpi-label">{label}</div>
        <div class="kpi-value-container">
            <div class="kpi-value">{value}</div>
            {delta_html}
        </div>
    </div>
    """
    return html

def render_header(title, subtitle=None):
    st.markdown(f"""
    <div class="main-header-container">
        <div>
            <h1 class="header-title">{title}</h1>
            {f"<p class='header-subtitle'>{subtitle}</p>" if subtitle else ""}
        </div>
        <div>
            <div class="system-badge">SYSTEM ONLINE</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

# --- Pages ---
if nav_selection == "Overview":
    render_header("Overview", "AI-DRIVEN EMERGENCY FLEET TELEMETRICS")
    
    # KPIs
    c1, c2, c3, c4 = st.columns(4)
    with c1: st.markdown(kpi_card("SIGNALS (24H)", "154", "12% surge"), unsafe_allow_html=True)
    with c2: st.markdown(kpi_card("UNITS DEPLOYED", "48"), unsafe_allow_html=True)
    with c3: st.markdown(kpi_card("AVG LATENCY", "5.2m", "-8% optimize"), unsafe_allow_html=True)
    with c4: st.markdown(kpi_card("ACTIVE NODES", "52"), unsafe_allow_html=True)
    
    st.write("")
    
    # Charts
    chart_cols = st.columns(2)
    
    with chart_cols[0]:
        st.markdown("<h3 style='font-size: 1.1rem; color: #94a3b8; margin-bottom: 16px;'>Temporal Latency Matrix</h3>", unsafe_allow_html=True)
        # Area chart
        x_vals = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"]
        y_vals = [4.2, 3.8, 5.1, 6.3, 5.8, 4.9]
        fig1 = go.Figure()
        fig1.add_trace(go.Scatter(
            x=x_vals, y=y_vals,
            fill='tozeroy',
            mode='lines+markers',
            line=dict(color='#00f0ff', width=3),
            marker=dict(color='#00f0ff', size=8, line=dict(color='white', width=1)),
            fillcolor='rgba(0, 240, 255, 0.15)'
        ))
        fig1.update_layout(
            margin=dict(l=0, r=0, t=20, b=0),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(family='Space Grotesk', color='#94a3b8'),
            yaxis_title="Latency (mins)",
            xaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)'),
            yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)')
        )
        st.plotly_chart(fig1, use_container_width=True, config={'displayModeBar': False})
        
    with chart_cols[1]:
        st.markdown("<h3 style='font-size: 1.1rem; color: #94a3b8; margin-bottom: 16px;'>Distress Vectors</h3>", unsafe_allow_html=True)
        categories = ["Cardiac", "Trauma", "Respiratory", "Neurological", "Other"]
        counts = [45, 38, 31, 22, 18]
        colors = ["#00f0ff", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981"]
        
        fig2 = go.Figure()
        fig2.add_trace(go.Bar(
            x=categories, y=counts,
            marker_color=colors,
            marker_line_width=0
        ))
        fig2.update_layout(
            margin=dict(l=0, r=0, t=20, b=0),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(family='Space Grotesk', color='#94a3b8'),
            xaxis=dict(showgrid=False),
            yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)')
        )
        st.plotly_chart(fig2, use_container_width=True, config={'displayModeBar': False})
        
    st.write("")
    st.markdown("<h3 style='font-size: 1.25rem; margin-top: 1rem; color: #f8fafc'>🌐 Topographic Overlay Module</h3>", unsafe_allow_html=True)
    st.markdown("<div class='info-panel'>Neural mapping interface awaiting geolocation data stream...</div>", unsafe_allow_html=True)

elif nav_selection == "Fleet Operations":
    render_header("Fleet Operations")
    
    st.markdown("<h3 style='font-size: 1.1rem; color: #94a3b8; margin-bottom: 8px;'>Unit Status Filter</h3>", unsafe_allow_html=True)
    
    # Render styled Streamlit Selectbox (we'll rely on native styling overriden by generic css where possible, or keep simple)
    status_filter = st.selectbox("", ["All", "Active", "Available", "Maintenance"], label_visibility="collapsed")
    st.write("")
    
    table_html = """
    <div class="cyber-table-wrapper">
    <table class="cyber-table">
        <thead>
            <tr>
                <th>Unit ID</th>
                <th>Assigned Pilot</th>
                <th>Matrix Status</th>
                <th>Grid Sector</th>
                <th>Sorties Today</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>AMB-2451</td>
                <td>Michael Rodriguez</td>
                <td><span style="color:#00f0ff;">Active</span></td>
                <td>Sector 7G</td>
                <td>12</td>
            </tr>
            <tr>
                <td>AMB-1893</td>
                <td>Lisa Chen</td>
                <td><span style="color:#00f0ff;">Active</span></td>
                <td>Sector 4A</td>
                <td>8</td>
            </tr>
            <tr>
                <td>AMB-3127</td>
                <td>David Brown</td>
                <td><span style="color:#00f0ff;">Active</span></td>
                <td>Sector 9B</td>
                <td>15</td>
            </tr>
            <tr>
                <td>AMB-5621</td>
                <td>Sarah Miller</td>
                <td><span style="color:#10b981;">Available</span></td>
                <td>Central Hub</td>
                <td>0</td>
            </tr>
            <tr>
                <td>AMB-7834</td>
                <td>James Wilson</td>
                <td><span style="color:#f59e0b;">Maintenance</span></td>
                <td>Depot</td>
                <td>0</td>
            </tr>
        </tbody>
    </table>
    </div>
    """
    st.markdown(table_html, unsafe_allow_html=True)
    
    st.markdown("<button class='cyber-button' style='width: 250px;'>PROVISION NEW UNIT</button>", unsafe_allow_html=True)

elif nav_selection == "Node Management":
    render_header("Node Management")
    
    table_html = """
    <div class="cyber-table-wrapper">
    <table class="cyber-table">
        <thead>
            <tr>
                <th>Node ID</th>
                <th>Sanctuary Name</th>
                <th>Network Link</th>
                <th>ICU Pods</th>
                <th>Med Bays</th>
                <th>Daily Intakes</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>NODE-001</td>
                <td>City General Hub</td>
                <td><span style="color:#10b981;">Online</span></td>
                <td>12</td>
                <td>48</td>
                <td>24</td>
            </tr>
            <tr>
                <td>NODE-002</td>
                <td>St. Mary Medical Hub</td>
                <td><span style="color:#10b981;">Online</span></td>
                <td>8</td>
                <td>35</td>
                <td>18</td>
            </tr>
            <tr>
                <td>NODE-003</td>
                <td>Regional Med Complex</td>
                <td><span style="color:#10b981;">Online</span></td>
                <td>15</td>
                <td>62</td>
                <td>31</td>
            </tr>
            <tr>
                <td>NODE-004</td>
                <td>Mercy Sanctuary</td>
                <td><span style="color:#f59e0b;">Limited</span></td>
                <td>6</td>
                <td>28</td>
                <td>12</td>
            </tr>
        </tbody>
    </table>
    </div>
    """
    st.markdown(table_html, unsafe_allow_html=True)
    
    st.markdown("<button class='cyber-button' style='width: 250px;'>REGISTER FACILITY</button>", unsafe_allow_html=True)

elif nav_selection == "Analytics Core":
    render_header("Analytics Core")
    
    st.markdown("<h3 style='font-size: 1.25rem; color: #f8fafc; margin-bottom: 16px;'>Neural Performance Core</h3>", unsafe_allow_html=True)
    
    # KPIs
    c1, c2, c3, c4 = st.columns(4)
    with c1: st.markdown(kpi_card("ROUTING EFFICIENCY", "99.2%"), unsafe_allow_html=True)
    with c2: st.markdown(kpi_card("SURVIVABILITY", "98.8%"), unsafe_allow_html=True)
    with c3: st.markdown(kpi_card("PATH DEVIATION", "1.4 km"), unsafe_allow_html=True)
    with c4: st.markdown(kpi_card("STRESS PEAK", "14:00-18:00"), unsafe_allow_html=True)
    
    st.markdown("<div class='sidebar-divider' style='margin: 32px 0;'></div>", unsafe_allow_html=True)
    
    # Charts
    chart_cols = st.columns(2)
    
    with chart_cols[0]:
        st.markdown("<h3 style='font-size: 1.1rem; color: #94a3b8; margin-bottom: 16px;'>Latency Correlation</h3>", unsafe_allow_html=True)
        # Line chart
        x_vals = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"]
        y_vals = [4.2, 3.8, 5.1, 6.3, 5.8, 4.9]
        fig1 = go.Figure()
        fig1.add_trace(go.Scatter(
            x=x_vals, y=y_vals,
            mode='lines+markers',
            line=dict(color='#8b5cf6', width=3),
            marker=dict(color='#00f0ff', size=8, line=dict(color='white', width=1))
        ))
        fig1.update_layout(
            margin=dict(l=0, r=0, t=20, b=0),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(family='Space Grotesk', color='#94a3b8'),
            yaxis_title="Latency (mins)",
            xaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)'),
            yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)')
        )
        st.plotly_chart(fig1, use_container_width=True, config={'displayModeBar': False})
        
    with chart_cols[1]:
        st.markdown("<h3 style='font-size: 1.1rem; color: #94a3b8; margin-bottom: 16px;'>Distress Incident Distribution</h3>", unsafe_allow_html=True)
        categories = ["Cardiac", "Trauma", "Respiratory", "Neurological", "Other"]
        counts = [45, 38, 31, 22, 18]
        colors = ["#ec4899", "#ec4899", "#ec4899", "#ec4899", "#ec4899"]
        
        fig2 = go.Figure()
        fig2.add_trace(go.Bar(
            x=categories, y=counts,
            marker_color=colors,
            marker_line_width=0
        ))
        fig2.update_layout(
            margin=dict(l=0, r=0, t=20, b=0),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(family='Space Grotesk', color='#94a3b8'),
            xaxis=dict(showgrid=False),
            yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)')
        )
        st.plotly_chart(fig2, use_container_width=True, config={'displayModeBar': False})

