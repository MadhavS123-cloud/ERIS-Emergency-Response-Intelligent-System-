import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import requests
from streamlit_autorefresh import st_autorefresh

# ── Page Config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="ERIS Command Center",
    page_icon="🚑",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Auto-refresh every 5 seconds ─────────────────────────────────────────────
st_autorefresh(interval=5000, limit=None, key="eris_autorefresh")

# ── Config ────────────────────────────────────────────────────────────────────
API_BASE = "http://localhost:5001/api/v1"
INTERNAL_HEADERS = {"x-internal-token": "ERIS_INTERNAL"}

# ── Data Fetch ────────────────────────────────────────────────────────────────
@st.cache_data(ttl=4)
def fetch_dashboard():
    try:
        r = requests.get(f"{API_BASE}/admin/dashboard-stats", headers=INTERNAL_HEADERS, timeout=4)
        r.raise_for_status()
        return r.json().get("data", {})
    except Exception as e:
        return {"error": str(e), "kpis": {}, "fleet": [], "nodes": [], "recentRequests": []}

@st.cache_data(ttl=4)
def fetch_hospitals():
    try:
        r = requests.get(f"{API_BASE}/hospitals", headers=INTERNAL_HEADERS, timeout=4)
        r.raise_for_status()
        return r.json().get("data", [])
    except Exception:
        return []

data = fetch_dashboard()
hospitals = fetch_hospitals()
kpis = data.get("kpis", {})
fleet = data.get("fleet", [])
nodes = data.get("nodes", [])
recent_requests = data.get("recentRequests", [])

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.image("https://img.icons8.com/color/96/ambulance.png", width=60)
    st.title("ERIS")
    st.caption("Emergency Response Intelligence System")
    st.divider()
    nav = st.radio(
        "Navigation",
        ["🗺️ Live Map", "📋 Active Emergencies", "🚑 Fleet", "🏥 Hospitals", "🤖 ML Insights"],
        label_visibility="collapsed",
    )
    st.divider()
    if data.get("error"):
        st.error(f"API Error: {data['error']}")
    else:
        st.success("● SYSTEM ONLINE")
    st.caption(f"Last refresh: {datetime.now().strftime('%H:%M:%S')}")

# ── KPI Row (always visible) ──────────────────────────────────────────────────
c1, c2, c3, c4 = st.columns(4)
c1.metric("🚨 Signals (24h)", kpis.get("signals24h", 0))
c2.metric("🚑 Units Deployed", kpis.get("unitsDeployed", 0))
c3.metric("⏱️ Avg ML ETA", f"{kpis.get('avgLatencyMins', 0)} min")
c4.metric("🏥 Active Nodes", kpis.get("activeNodes", 0))
st.divider()

# ═══════════════════════════════════════════════════════════════════════════════
# 🗺️ LIVE MAP
# ═══════════════════════════════════════════════════════════════════════════════
if nav == "🗺️ Live Map":
    st.subheader("🗺️ Live Operational Map")
    st.caption("Real-time positions of patients, ambulances, and hospitals")

    map_points = []

    # Patient locations (active requests only)
    for r in recent_requests:
        if r.get("locationLat") and r.get("locationLng") and r.get("status") not in ("COMPLETED", "CANCELLED"):
            map_points.append({
                "lat": r["locationLat"],
                "lon": r["locationLng"],
                "label": f"🔴 Patient: {r.get('patientName','?')} | {r.get('emergencyType','?')}",
                "type": "Patient",
                "color": "red",
                "size": 14,
                "info": f"Status: {r.get('status')} | ETA: {r.get('mlDelayMins','?')} min",
            })

    # Ambulance locations
    for a in fleet:
        if a.get("locationLat") and a.get("locationLng"):
            map_points.append({
                "lat": a["locationLat"],
                "lon": a["locationLng"],
                "label": f"🚑 {a.get('unitId','?')} | {a.get('driverName','?')}",
                "type": "Ambulance",
                "color": "blue" if a.get("status") == "Active" else "green",
                "size": 12,
                "info": f"Status: {a.get('status')} | Hub: {a.get('hospitalName','?')}",
            })

    # Hospital locations
    for h in hospitals:
        if h.get("locationLat") and h.get("locationLng"):
            map_points.append({
                "lat": h["locationLat"],
                "lon": h["locationLng"],
                "label": f"🏥 {h.get('name','?')}",
                "type": "Hospital",
                "color": "green",
                "size": 16,
                "info": f"ICU: {h.get('icuBedsAvailable',0)} | General: {h.get('generalBedsAvailable',0)}",
            })

    if map_points:
        df_map = pd.DataFrame(map_points)
        color_map = {"Patient": "#ef4444", "Ambulance": "#2563eb", "Hospital": "#10b981"}
        fig = px.scatter_mapbox(
            df_map,
            lat="lat", lon="lon",
            color="type",
            color_discrete_map=color_map,
            size="size",
            hover_name="label",
            hover_data={"info": True, "lat": False, "lon": False, "size": False, "type": False},
            zoom=11,
            height=600,
        )
        fig.update_layout(
            mapbox_style="carto-darkmatter",
            margin={"r": 0, "t": 0, "l": 0, "b": 0},
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No location data available yet. Waiting for active requests and ambulance GPS.")

# ═══════════════════════════════════════════════════════════════════════════════
# 📋 ACTIVE EMERGENCIES
# ═══════════════════════════════════════════════════════════════════════════════
elif nav == "📋 Active Emergencies":
    st.subheader("📋 Active Emergency Requests")

    active = [r for r in recent_requests if r.get("status") not in ("COMPLETED", "CANCELLED")]
    closed = [r for r in recent_requests if r.get("status") in ("COMPLETED", "CANCELLED")]

    if not active:
        st.success("✅ No active emergencies right now.")
    else:
        for r in active:
            priority = "🔴 CRITICAL" if r.get("emergencyType","").lower() in ("cardiac arrest","stroke","panic sos") else "🟡 HIGH"
            with st.container(border=True):
                col1, col2, col3 = st.columns([3, 1, 1])
                with col1:
                    st.markdown(f"### `{r['id'][:8].upper()}` — {r.get('emergencyType','?')}")
                    st.caption(f"Patient: **{r.get('patientName','?')}** | Contact: {r.get('patientPhone','N/A')}")
                    st.caption(f"📍 {r.get('pickupAddress') or f\"{r.get('locationLat','?')}, {r.get('locationLng','?')}\"}")
                with col2:
                    st.markdown(f"**Status**")
                    st.markdown(f"`{r.get('status','?')}`")
                with col3:
                    st.markdown(f"**Priority**")
                    st.markdown(priority)

                if r.get("isFake"):
                    st.error("🚨 MARKED AS FALSE REQUEST")
                if r.get("isSuspicious"):
                    st.warning(f"⚠️ SUSPICIOUS: {r.get('suspiciousReason','Unknown reason')}")

                m1, m2, m3 = st.columns(3)
                m1.metric("AI Delay Risk", r.get("mlRisk") or "Analyzing...")
                m2.metric("ML ETA (min)", r.get("mlDelayMins") or "--")
                m3.metric("Device Trust", r.get("trustScoreAtRequest", "N/A"))

                if r.get("mlReasons"):
                    with st.expander("🤖 ML Explainability"):
                        for reason in r["mlReasons"]:
                            st.write(f"• {reason}")
                        if r.get("mlActions"):
                            st.markdown("**Suggested Actions:**")
                            for action in r["mlActions"]:
                                st.write(f"→ {action}")

                if r.get("ambulancePlate"):
                    st.caption(f"🚑 Assigned: {r['ambulancePlate']} | Driver: {r.get('driverName','?')} | Hospital: {r.get('hospitalName','?')}")

    if closed:
        with st.expander(f"📁 Closed Requests ({len(closed)})"):
            df_closed = pd.DataFrame([{
                "ID": r["id"][:8].upper(),
                "Type": r.get("emergencyType","?"),
                "Status": r.get("status","?"),
                "Patient": r.get("patientName","?"),
                "Hospital": r.get("hospitalName","?"),
                "ML Risk": r.get("mlRisk","?"),
                "Fake": "⚠️" if r.get("isFake") else "✓",
            } for r in closed])
            st.dataframe(df_closed, use_container_width=True, hide_index=True)

# ═══════════════════════════════════════════════════════════════════════════════
# 🚑 FLEET
# ═══════════════════════════════════════════════════════════════════════════════
elif nav == "🚑 Fleet":
    st.subheader("🚑 Fleet Operations")

    if not fleet:
        st.info("No fleet data available.")
    else:
        active_units = [a for a in fleet if a.get("status") == "Active"]
        available_units = [a for a in fleet if a.get("status") == "Available"]

        fa, fb = st.columns(2)
        fa.metric("Active Units", len(active_units))
        fb.metric("Available Units", len(available_units))

        df_fleet = pd.DataFrame([{
            "Unit": a.get("unitId","?"),
            "Driver": a.get("driverName","Unassigned"),
            "Status": a.get("status","?"),
            "Hospital": a.get("hospitalName","?"),
            "GPS": f"{a['locationLat']:.4f}, {a['locationLng']:.4f}" if a.get("locationLat") else "No GPS",
        } for a in fleet])

        st.dataframe(
            df_fleet.style.apply(
                lambda row: ["background-color: rgba(239,68,68,0.15)" if row["Status"] == "Active" else "" for _ in row],
                axis=1
            ),
            use_container_width=True,
            hide_index=True,
        )

# ═══════════════════════════════════════════════════════════════════════════════
# 🏥 HOSPITALS
# ═══════════════════════════════════════════════════════════════════════════════
elif nav == "🏥 Hospitals":
    st.subheader("🏥 Hospital Network")

    if not nodes:
        st.info("No hospital data available.")
    else:
        df_nodes = pd.DataFrame([{
            "Node ID": n.get("nodeId","?"),
            "Hospital": n.get("name","?"),
            "ICU Available": n.get("icuBeds", 0),
            "Total Beds": n.get("totalBeds", 0),
            "Status": n.get("status","?"),
        } for n in nodes])
        st.dataframe(df_nodes, use_container_width=True, hide_index=True)

        # Capacity bar chart
        if hospitals:
            df_cap = pd.DataFrame([{
                "Hospital": h.get("name","?"),
                "ICU": h.get("icuBedsAvailable", 0),
                "General": h.get("generalBedsAvailable", 0),
                "Ventilators": h.get("ventilatorsAvailable", 0),
            } for h in hospitals])
            fig = px.bar(
                df_cap.melt(id_vars="Hospital", var_name="Type", value_name="Available"),
                x="Hospital", y="Available", color="Type",
                barmode="group",
                title="Available Capacity by Hospital",
                color_discrete_map={"ICU": "#ef4444", "General": "#2563eb", "Ventilators": "#10b981"},
            )
            fig.update_layout(plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig, use_container_width=True)

# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 ML INSIGHTS
# ═══════════════════════════════════════════════════════════════════════════════
elif nav == "🤖 ML Insights":
    st.subheader("🤖 ML Delay Prediction Insights")

    requests_with_ml = [r for r in recent_requests if r.get("mlRisk")]

    if not requests_with_ml:
        st.info("No ML predictions available yet. ML service may be offline or no requests processed.")
    else:
        # Risk distribution
        risk_counts = {}
        for r in requests_with_ml:
            risk = r.get("mlRisk", "Unknown")
            risk_counts[risk] = risk_counts.get(risk, 0) + 1

        col1, col2 = st.columns(2)
        with col1:
            fig_pie = px.pie(
                values=list(risk_counts.values()),
                names=list(risk_counts.keys()),
                title="Delay Risk Distribution",
                color_discrete_map={"Low": "#10b981", "Medium": "#f59e0b", "High": "#ef4444"},
            )
            fig_pie.update_layout(paper_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig_pie, use_container_width=True)

        with col2:
            delays = [r["mlDelayMins"] for r in requests_with_ml if r.get("mlDelayMins")]
            if delays:
                fig_hist = px.histogram(
                    x=delays,
                    nbins=10,
                    title="ML Predicted Delay Distribution (mins)",
                    labels={"x": "Delay (mins)", "y": "Count"},
                    color_discrete_sequence=["#2563eb"],
                )
                fig_hist.update_layout(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
                st.plotly_chart(fig_hist, use_container_width=True)

        # Detailed table
        df_ml = pd.DataFrame([{
            "ID": r["id"][:8].upper(),
            "Type": r.get("emergencyType","?"),
            "Risk": r.get("mlRisk","?"),
            "ETA (min)": r.get("mlDelayMins","?"),
            "Status": r.get("status","?"),
            "Top Reason": r["mlReasons"][0] if r.get("mlReasons") else "N/A",
        } for r in requests_with_ml])
        st.dataframe(df_ml, use_container_width=True, hide_index=True)

        # Test ML service directly
        st.divider()
        st.markdown("**🧪 Test ML Prediction**")
        with st.form("ml_test_form"):
            tc1, tc2 = st.columns(2)
            dist = tc1.number_input("Distance (km)", value=5.0, min_value=0.1)
            traffic = tc2.selectbox("Traffic Level", ["Low", "Medium", "High"])
            weather = tc1.selectbox("Weather", ["Clear", "Rain", "Fog", "Snow"])
            hour = tc2.slider("Hour of Day", 0, 23, datetime.now().hour)
            submitted = st.form_submit_button("Run Prediction")

        if submitted:
            try:
                ML_URL = "http://localhost:8000"
                payload = {
                    "distance_km": dist,
                    "time_of_day": hour,
                    "day_of_week": datetime.now().weekday(),
                    "traffic_level": traffic,
                    "weather": weather,
                    "area_type": "Urban",
                    "driver_response_time_mins": 2.0,
                    "available_ambulances_nearby": 3,
                }
                resp = requests.post(f"{ML_URL}/predict", json=payload, timeout=5)
                result = resp.json()
                r1, r2, r3 = st.columns(3)
                r1.metric("Delay Risk", result.get("delay_risk", "?"))
                r2.metric("Expected Delay", f"{result.get('expected_delay_minutes', '?')} min")
                r3.metric("Main Cause", result.get("main_cause", "?"))
                if result.get("suggested_action"):
                    st.info(f"💡 Suggested Action: {result['suggested_action']}")
            except Exception as e:
                st.error(f"ML service unreachable: {e}")
