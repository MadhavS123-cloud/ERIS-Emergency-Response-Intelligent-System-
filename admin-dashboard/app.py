import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
import requests
from streamlit_autorefresh import st_autorefresh

# --- Page Config ---
st.set_page_config(page_title="⚡ ERIS COMMAND CENTER", layout="wide", initial_sidebar_state="expanded")

# --- Polling / Auto-Refresh via backend ---
count = st_autorefresh(interval=5000, limit=None, key="dashboard_autorefresh")

API_URL = "http://localhost:5001/api/v1/admin/dashboard-stats"
try:
    response = requests.get(API_URL, headers={'x-internal-token': 'ERIS_INTERNAL'})
    response.raise_for_status()
    api_data = response.json().get('data', {})
except Exception as e:
    api_data = {
        "kpis": {"signals24h": 0, "unitsDeployed": 0, "avgLatencyMins": "0.0", "activeNodes": 0},
        "fleet": [], "nodes": [], "recentRequests": []
    }

# Extract Data
kpis = api_data.get("kpis", {})
fleet = api_data.get("fleet", [])
nodes = api_data.get("nodes", [])
recent_requests = api_data.get("recentRequests", [])

# --- Sidebar UI ---
with st.sidebar:
    st.title("⚡ ERIS")
    st.caption("COMMAND CENTER")
    st.divider()
    nav_selection = st.radio("Navigation", ["Overview", "Live Emergencies", "Fleet", "Nodes"])
    
if nav_selection == "Overview":
    st.title("Overview")
    st.info("SYSTEM ONLINE")
    
    # KPIs using native Streamlit metrics
    c1, c2, c3, c4 = st.columns(4)
    with c1: 
        st.metric("Signals (24h)", kpis.get('signals24h', 0))
    with c2: 
        st.metric("Units Deployed", kpis.get('unitsDeployed', 0))
    with c3: 
        st.metric("Avg Latency", f"{kpis.get('avgLatencyMins', 0)}m")
    with c4: 
        st.metric("Active Nodes", kpis.get('activeNodes', 0))
    
    st.divider()
    
    st.subheader("Received Dispatch Signals")
    df = pd.DataFrame(recent_requests)
    if not df.empty:
        df = df[['id', 'emergencyType', 'status', 'mlRisk', 'mlDelayMins']]
        df.columns = ["ID", "Incident", "Status", "AI Risk Level", "ETA (mins)"]
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.write("No recent signals.")

elif nav_selection == "Live Emergencies":
    st.title("Live Emergency Panel")
    st.info("SYSTEM ONLINE | AI Augmented Dispatches")
    
    if not recent_requests:
        st.success("No active emergency signals.")
        
    for r in recent_requests:
        with st.container(border=True):
            col1, col2 = st.columns([3, 1])
            with col1:
                st.subheader(f"REQ: {r['id'][:8]} | {r['emergencyType']}")
            with col2:
                st.subheader(f"[{r['status']}]")
            
            metric_col1, metric_col2 = st.columns(2)
            with metric_col1:
                st.metric("AI Delay Risk", r.get('mlRisk', 'Analyzing...'))
            with metric_col2:
                st.metric("Expected ETA (Min)", r.get('mlDelayMins', '--'))
                
            st.divider()
            
            st.write("**Explainability (SHAP Core)**")
            reasons = r.get('mlReasons', [])
            if reasons:
                for reason in reasons:
                    st.write(f"- {reason}")
            else:
                st.write("- Standard Nominal Operations Parameters.")
                
            st.write("**Suggested Actions**")
            actions = r.get('mlActions', [])
            if actions:
                for action in actions:
                    st.write(f"- {action}")
            else:
                st.write("- Proceed normally.")

elif nav_selection == "Fleet":
    st.title("Fleet Operations")
    
    df = pd.DataFrame(fleet)
    if not df.empty:
        df.columns = ["Unit ID", "Pilot", "Status", "Assigned Hub"]
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.write("No fleet data available.")

elif nav_selection == "Nodes":
    st.title("Node Management")
    
    df = pd.DataFrame(nodes)
    if not df.empty:
        df.columns = ["Node ID", "Hub Name", "ICU Pods", "Total Pods", "Status"]
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.write("No nodes data available.")
