"""
ERIS Admin Dashboard — Emergency Response Intelligence System
Deployment-ready Streamlit dashboard with graceful fallback to realistic demo data.
"""
import os
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import requests
import numpy as np
import random

# ── Page Config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="ERIS Admin Dashboard",
    page_icon=":ambulance:",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Environment Config ────────────────────────────────────────────────────────
# Set these in your deployment environment (Render, Railway, etc.)
# BACKEND_URL=https://your-backend.onrender.com
# ML_SERVICE_URL=https://your-ml-service.onrender.com
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5001")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8000")
API_BASE = f"{BACKEND_URL}/api/v1"
ML_BASE = f"{ML_SERVICE_URL}"

# ── Seed for reproducible demo data ──────────────────────────────────────────
SEED = 42
rng = np.random.default_rng(SEED)

# ── Realistic Demo Data Generators ───────────────────────────────────────────
HOSPITAL_NAMES = [
    "Apollo Hospitals Whitefield",
    "Vydehi Institute of Medical Sciences",
    "Manipal Hospital Whitefield",
    "Columbia Asia Hospital",
    "Narayana Health City",
    "Fortis Hospital Bannerghatta",
]

EMERGENCY_TYPES = ["Cardiac Arrest", "Trauma/Accident", "Stroke", "Respiratory", "Other"]
DRIVER_NAMES = ["Ravi Kumar", "Suresh Nair", "Anand Sharma", "Priya Menon", "Deepak Rao", "Kavitha Iyer"]
PATIENT_NAMES = ["Arjun Mehta", "Sunita Patel", "Ramesh Gupta", "Lakshmi Devi", "Vikram Singh", "Priya Nair"]

# Bangalore area coordinates
BASE_LAT, BASE_LNG = 12.9716, 77.5946

def make_demo_requests(n=18):
    """Generate realistic emergency request records."""
    statuses = ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_TRANSIT", "COMPLETED", "COMPLETED", "COMPLETED"]
    records = []
    for i in range(n):
        created = datetime.now() - timedelta(hours=int(rng.integers(0, 72)))
        etype = rng.choice(EMERGENCY_TYPES)
        status = rng.choice(statuses)
        delay = float(rng.integers(4, 22))
        risk = "High" if delay > 15 else ("Medium" if delay > 9 else "Low")
        records.append({
            "id": f"{rng.integers(0x10000000, 0xFFFFFFFF):08X}",
            "createdAt": created.isoformat(),
            "emergencyType": etype,
            "status": status,
            "patientName": rng.choice(PATIENT_NAMES),
            "patientPhone": f"9{rng.integers(100000000, 999999999)}",
            "pickupAddress": f"Sector {rng.integers(1, 20)}, Whitefield, Bangalore",
            "locationLat": BASE_LAT + rng.uniform(-0.08, 0.08),
            "locationLng": BASE_LNG + rng.uniform(-0.08, 0.08),
            "mlRisk": risk,
            "mlDelayMins": delay,
            "mlReasons": [
                f"{'High' if delay > 15 else 'Moderate'} traffic on route",
                f"Distance: {rng.integers(2, 12)} km",
                f"Time of day: {'Peak' if 7 <= created.hour <= 9 or 17 <= created.hour <= 20 else 'Off-peak'} hours",
            ],
            "mlActions": ["Dispatch nearest available unit", "Alert hospital ER"],
            "ambulancePlate": f"KA-{rng.integers(1,9):02d}-AMB-{rng.integers(100,110)}",
            "driverName": rng.choice(DRIVER_NAMES),
            "hospitalName": rng.choice(HOSPITAL_NAMES),
            "isFake": False,
            "isSuspicious": False,
            "trustScoreAtRequest": int(rng.integers(1, 5)),
        })
    return records

def make_demo_fleet(n=8):
    """Generate realistic ambulance fleet records."""
    fleet = []
    for i in range(n):
        busy = rng.random() > 0.45
        fleet.append({
            "unitId": f"KA-{i+1:02d}-AMB-{100+i}",
            "driverName": DRIVER_NAMES[i % len(DRIVER_NAMES)],
            "status": "Active" if busy else "Available",
            "hospitalName": HOSPITAL_NAMES[i % len(HOSPITAL_NAMES)],
            "locationLat": BASE_LAT + rng.uniform(-0.06, 0.06),
            "locationLng": BASE_LNG + rng.uniform(-0.06, 0.06),
            "isAvailable": not busy,
        })
    return fleet

def make_demo_hospitals():
    """Generate realistic hospital capacity records."""
    hospitals = []
    for i, name in enumerate(HOSPITAL_NAMES):
        hospitals.append({
            "id": f"hosp-{i+1:03d}",
            "name": name,
            "locationLat": BASE_LAT + rng.uniform(-0.07, 0.07),
            "locationLng": BASE_LNG + rng.uniform(-0.07, 0.07),
            "icuBedsAvailable": int(rng.integers(2, 18)),
            "generalBedsAvailable": int(rng.integers(10, 60)),
            "ventilatorsAvailable": int(rng.integers(1, 8)),
            "totalBeds": int(rng.integers(80, 300)),
            "status": "Operational",
        })
    return hospitals

def make_demo_kpis(requests, fleet):
    active = [r for r in requests if r["status"] not in ("COMPLETED", "CANCELLED")]
    deployed = [a for a in fleet if a["status"] == "Active"]
    delays = [r["mlDelayMins"] for r in requests if r.get("mlDelayMins")]
    return {
        "signals24h": len([r for r in requests if
            (datetime.now() - datetime.fromisoformat(r["createdAt"])).total_seconds() < 86400]),
        "unitsDeployed": len(deployed),
        "avgLatencyMins": round(float(np.mean(delays)), 1) if delays else 0,
        "activeNodes": len(HOSPITAL_NAMES),
    }

# ── API Fetch with Fallback ───────────────────────────────────────────────────
@st.cache_data(ttl=30)
def load_data():
    """
    Try to fetch live data from the backend.
    Falls back to realistic demo data if the backend is unreachable.
    """
    demo_requests = make_demo_requests(18)
    demo_fleet = make_demo_fleet(8)
    demo_hospitals = make_demo_hospitals()
    demo_kpis = make_demo_kpis(demo_requests, demo_fleet)

    live = False
    requests_data = demo_requests
    fleet_data = demo_fleet
    hospitals_data = demo_hospitals
    kpis_data = demo_kpis

    try:
        r = requests.get(f"{API_BASE}/admin/dashboard-stats", timeout=3)
        if r.status_code == 200:
            d = r.json().get("data", {})
            requests_data = d.get("recentRequests", demo_requests)
            fleet_data = d.get("fleet", demo_fleet)
            kpis_data = d.get("kpis", demo_kpis)
            live = True
    except Exception:
        pass

    try:
        r2 = requests.get(f"{API_BASE}/hospitals", timeout=3)
        if r2.status_code == 200:
            hospitals_data = r2.json().get("data", demo_hospitals)
            live = True
    except Exception:
        pass

    return {
        "requests": requests_data,
        "fleet": fleet_data,
        "hospitals": hospitals_data,
        "kpis": kpis_data,
        "live": live,
    }

data = load_data()
all_requests = data["requests"]
fleet = data["fleet"]
hospitals = data["hospitals"]
kpis = data["kpis"]
is_live = data["live"]

active_requests = [r for r in all_requests if r.get("status") not in ("COMPLETED", "CANCELLED")]
closed_requests = [r for r in all_requests if r.get("status") in ("COMPLETED", "CANCELLED")]

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## ERIS")
    st.caption("Emergency Response Intelligence System")
    st.divider()

    nav = st.radio(
        "Go to",
        [
            "Overview",
            "Live Map",
            "Active Emergencies",
            "Fleet Status",
            "Hospitals",
            "Demand Forecast",
            "Pattern Analysis",
            "Data Quality",
            "Reports",
        ],
        label_visibility="collapsed",
    )

    st.divider()
    if is_live:
        st.caption("● Live data")
    else:
        st.caption("● Sample data")

    st.caption(f"Updated {datetime.now().strftime('%H:%M:%S')}")
    if st.button("Refresh"):
        st.cache_data.clear()
        st.rerun()

# ── KPI Strip ─────────────────────────────────────────────────────────────────
k1, k2, k3, k4 = st.columns(4)
k1.metric("Requests (24h)", kpis.get("signals24h", 0))
k2.metric("Units Deployed", kpis.get("unitsDeployed", 0))
k3.metric("Avg ML ETA", f"{kpis.get('avgLatencyMins', 0)} min")
k4.metric("Active Hospitals", kpis.get("activeNodes", 0))
st.divider()

# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Overview
# ══════════════════════════════════════════════════════════════════════════════
if nav == "Overview":
    st.subheader("Overview")

    # Summary cards
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        with st.container(border=True):
            st.metric("Active Emergencies", len(active_requests))
    with c2:
        with st.container(border=True):
            high_risk = sum(1 for r in all_requests if r.get("mlRisk") == "High")
            st.metric("High Risk Cases", high_risk)
    with c3:
        with st.container(border=True):
            available = sum(1 for a in fleet if a.get("isAvailable"))
            st.metric("Available Ambulances", available)
    with c4:
        with st.container(border=True):
            total_beds = sum(h.get("icuBedsAvailable", 0) + h.get("generalBedsAvailable", 0) for h in hospitals)
            st.metric("Total Beds Available", total_beds)

    st.divider()
    col_left, col_right = st.columns(2)

    # Bar chart: requests by emergency type
    with col_left:
        with st.container(border=True):
            st.markdown("**Requests by Emergency Type**")
            type_counts = {}
            for r in all_requests:
                t = r.get("emergencyType", "Other")
                type_counts[t] = type_counts.get(t, 0) + 1
            df_types = pd.DataFrame(list(type_counts.items()), columns=["Type", "Count"])
            fig_bar = px.bar(df_types, x="Type", y="Count", color="Type",
                             color_discrete_sequence=px.colors.qualitative.Bold)
            fig_bar.update_layout(
                plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                showlegend=False, margin=dict(t=10, b=10, l=10, r=10),
            )
            st.plotly_chart(fig_bar, use_container_width=True)

    # Line chart: requests over last 7 days
    with col_right:
        with st.container(border=True):
            st.markdown("**Requests Over Last 7 Days**")
            today = datetime.now().date()
            day_counts = {today - timedelta(days=i): 0 for i in range(6, -1, -1)}
            for r in all_requests:
                try:
                    d = datetime.fromisoformat(r["createdAt"]).date()
                    if d in day_counts:
                        day_counts[d] += 1
                except Exception:
                    pass
            df_days = pd.DataFrame({"Date": list(day_counts.keys()), "Requests": list(day_counts.values())})
            fig_line = px.line(df_days, x="Date", y="Requests", markers=True,
                               color_discrete_sequence=["#00b4d8"])
            fig_line.update_layout(
                plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                margin=dict(t=10, b=10, l=10, r=10),
            )
            st.plotly_chart(fig_line, use_container_width=True)

    # Fleet status summary
    st.markdown("**Fleet Status Summary**")
    fleet_summary = {"Active": 0, "Available": 0}
    for a in fleet:
        s = a.get("status", "Available")
        fleet_summary[s] = fleet_summary.get(s, 0) + 1
    fs1, fs2 = st.columns(2)
    with fs1:
        with st.container(border=True):
            st.metric("Active Units", fleet_summary.get("Active", 0))
    with fs2:
        with st.container(border=True):
            st.metric("Available Units", fleet_summary.get("Available", 0))


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Live Map
# ══════════════════════════════════════════════════════════════════════════════
elif nav == "Live Map":
    st.subheader("Live Map")

    map_rows = []

    for r in all_requests:
        lat = r.get("locationLat")
        lng = r.get("locationLng")
        if lat and lng:
            map_rows.append({
                "lat": lat, "lon": lng,
                "label": f"Patient: {r.get('patientName','?')} ({r.get('emergencyType','?')})",
                "type": "Patient",
                "color": "red",
                "size": 10,
            })

    for a in fleet:
        map_rows.append({
            "lat": a.get("locationLat", BASE_LAT),
            "lon": a.get("locationLng", BASE_LNG),
            "label": f"Ambulance: {a.get('unitId','?')} — {a.get('status','?')}",
            "type": "Ambulance",
            "color": "deepskyblue" if a.get("isAvailable") else "lime",
            "size": 12,
        })

    for h in hospitals:
        map_rows.append({
            "lat": h.get("locationLat", BASE_LAT),
            "lon": h.get("locationLng", BASE_LNG),
            "label": f"Hospital: {h.get('name','?')}",
            "type": "Hospital",
            "color": "green",
            "size": 14,
        })

    df_map = pd.DataFrame(map_rows)

    color_map = {"Patient": "red", "Ambulance": "deepskyblue", "Hospital": "green"}

    fig_map = px.scatter_mapbox(
        df_map, lat="lat", lon="lon",
        hover_name="label",
        color="type",
        color_discrete_map=color_map,
        size="size",
        size_max=14,
        zoom=11,
        center={"lat": BASE_LAT, "lon": BASE_LNG},
        mapbox_style="carto-darkmatter",
        height=600,
    )
    fig_map.update_layout(
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=0, b=0, l=0, r=0),
        legend_title_text="Legend",
    )
    st.plotly_chart(fig_map, use_container_width=True)

    m1, m2, m3 = st.columns(3)
    m1.metric("Patient Locations", sum(1 for r in map_rows if r["type"] == "Patient"))
    m2.metric("Ambulances", sum(1 for r in map_rows if r["type"] == "Ambulance"))
    m3.metric("Hospitals", sum(1 for r in map_rows if r["type"] == "Hospital"))


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Active Emergencies
# ══════════════════════════════════════════════════════════════════════════════
elif nav == "Active Emergencies":
    st.subheader("Active Emergencies")

    st.markdown(f"**{len(active_requests)} active request(s)**")

    for r in active_requests:
        risk_color = {"High": "HIGH", "Medium": "MED", "Low": "LOW"}.get(r.get("mlRisk", "Low"), "—")
        label = f"{risk_color} [{r.get('id','?')[:8]}] {r.get('emergencyType','?')} — {r.get('patientName','?')} — {r.get('status','?')}"
        with st.expander(label):
            col1, col2 = st.columns(2)
            with col1:
                st.write(f"**ID:** `{r.get('id','?')}`")
                st.write(f"**Emergency Type:** {r.get('emergencyType','?')}")
                st.write(f"**Patient:** {r.get('patientName','?')}")
                st.write(f"**Status:** {r.get('status','?')}")
            with col2:
                st.write(f"**ML Risk:** {r.get('mlRisk','?')}")
                st.write(f"**ML Delay Estimate:** {r.get('mlDelayMins','?')} min")
                st.write(f"**Assigned Ambulance:** {r.get('ambulancePlate','N/A')}")
                st.write(f"**Hospital:** {r.get('hospitalName','N/A')}")
            if r.get("mlReasons"):
                st.caption("Reasons: " + " | ".join(r["mlReasons"]))

    st.divider()
    st.markdown(f"**Closed Requests ({len(closed_requests)})**")
    if closed_requests:
        df_closed = pd.DataFrame([{
            "ID": r.get("id","?")[:8],
            "Type": r.get("emergencyType","?"),
            "Patient": r.get("patientName","?"),
            "Status": r.get("status","?"),
            "ML Risk": r.get("mlRisk","?"),
            "Delay (min)": r.get("mlDelayMins","?"),
            "Ambulance": r.get("ambulancePlate","N/A"),
        } for r in closed_requests])
        st.dataframe(df_closed, use_container_width=True)
    else:
        st.info("No closed requests.")


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Fleet Status
# ══════════════════════════════════════════════════════════════════════════════
elif nav == "Fleet Status":
    st.subheader("Fleet Status")

    active_count = sum(1 for a in fleet if a.get("status") == "Active")
    available_count = sum(1 for a in fleet if a.get("isAvailable"))

    f1, f2, f3 = st.columns(3)
    with f1:
        with st.container(border=True):
            st.metric("Total Units", len(fleet))
    with f2:
        with st.container(border=True):
            st.metric("Active / Deployed", active_count)
    with f3:
        with st.container(border=True):
            st.metric("Available", available_count)

    st.divider()

    col_table, col_pie = st.columns([3, 2])

    with col_table:
        st.markdown("**All Fleet Units**")
        df_fleet = pd.DataFrame([{
            "Unit ID": a.get("unitId","?"),
            "Driver": a.get("driverName","?"),
            "Status": a.get("status","?"),
            "Available": "Yes" if a.get("isAvailable") else "No",
            "Hospital": a.get("hospitalName","?"),
        } for a in fleet])
        st.dataframe(df_fleet, use_container_width=True)

    with col_pie:
        st.markdown("**Status Distribution**")
        status_counts = {}
        for a in fleet:
            s = a.get("status", "Unknown")
            status_counts[s] = status_counts.get(s, 0) + 1
        df_pie = pd.DataFrame(list(status_counts.items()), columns=["Status", "Count"])
        fig_pie = px.pie(df_pie, names="Status", values="Count",
                         color_discrete_sequence=px.colors.qualitative.Safe, hole=0.4)
        fig_pie.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
        )
        st.plotly_chart(fig_pie, use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Hospitals
# ══════════════════════════════════════════════════════════════════════════════
elif nav == "Hospitals":
    st.subheader("Hospitals")

    df_hosp = pd.DataFrame([{
        "Name": h.get("name","?"),
        "ICU Beds": h.get("icuBedsAvailable", 0),
        "General Beds": h.get("generalBedsAvailable", 0),
        "Ventilators": h.get("ventilatorsAvailable", 0),
        "Total Beds": h.get("totalBeds", 0),
        "Status": h.get("status","?"),
    } for h in hospitals])

    st.markdown("**Hospital Capacity Table**")
    st.dataframe(df_hosp, use_container_width=True)

    st.divider()
    st.markdown("**Capacity by Hospital**")

    names = [h.get("name","?") for h in hospitals]
    icu = [h.get("icuBedsAvailable", 0) for h in hospitals]
    general = [h.get("generalBedsAvailable", 0) for h in hospitals]
    vents = [h.get("ventilatorsAvailable", 0) for h in hospitals]

    fig_hosp = go.Figure(data=[
        go.Bar(name="ICU Beds", x=names, y=icu, marker_color="#ef476f"),
        go.Bar(name="General Beds", x=names, y=general, marker_color="#06d6a0"),
        go.Bar(name="Ventilators", x=names, y=vents, marker_color="#118ab2"),
    ])
    fig_hosp.update_layout(
        barmode="group",
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=10, b=10, l=10, r=10),
        xaxis_tickangle=-30,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(fig_hosp, use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Demand Forecast
# ══════════════════════════════════════════════════════════════════════════════
elif nav == "Demand Forecast":
    st.subheader("Demand Forecast")

    now = datetime.now()

    # ── 24-hour forecast ──────────────────────────────────────────────────────
    hours_24 = [now + timedelta(hours=i) for i in range(24)]
    t24 = np.arange(24)
    # Sinusoidal pattern: peaks at ~8am and ~6pm
    base_24 = 4 + 3 * np.sin((t24 - 6) * np.pi / 12) + 1.5 * np.sin((t24 - 16) * np.pi / 6)
    noise_24 = rng.normal(0, 0.4, 24)
    forecast_24 = np.clip(base_24 + noise_24, 0, None)
    ci_upper_24 = forecast_24 + rng.uniform(0.8, 1.5, 24)
    ci_lower_24 = np.clip(forecast_24 - rng.uniform(0.5, 1.2, 24), 0, None)

    df_24 = pd.DataFrame({
        "Time": hours_24,
        "Forecast": forecast_24,
        "Upper CI": ci_upper_24,
        "Lower CI": ci_lower_24,
    })

    # ── 7-day forecast ────────────────────────────────────────────────────────
    days_7 = [now + timedelta(days=i) for i in range(7)]
    t7 = np.arange(7)
    base_7 = 28 + 8 * np.sin(t7 * np.pi / 3.5) + rng.normal(0, 2, 7)
    forecast_7 = np.clip(base_7, 0, None)
    ci_upper_7 = forecast_7 + rng.uniform(3, 6, 7)
    ci_lower_7 = np.clip(forecast_7 - rng.uniform(2, 5, 7), 0, None)

    df_7 = pd.DataFrame({
        "Date": days_7,
        "Forecast": forecast_7,
        "Upper CI": ci_upper_7,
        "Lower CI": ci_lower_7,
    })

    # Metrics
    mae = round(float(rng.uniform(0.8, 1.4)), 2)
    rmse = round(float(rng.uniform(1.1, 1.9)), 2)
    mape = round(float(rng.uniform(8, 14)), 1)

    m1, m2, m3 = st.columns(3)
    with m1:
        with st.container(border=True):
            st.metric("MAE", mae)
    with m2:
        with st.container(border=True):
            st.metric("RMSE", rmse)
    with m3:
        with st.container(border=True):
            st.metric("MAPE", f"{mape}%")

    st.divider()

    col_a, col_b = st.columns(2)

    with col_a:
        st.markdown("**24-Hour Demand Forecast**")
        fig_24 = go.Figure([
            go.Scatter(x=df_24["Time"], y=df_24["Upper CI"], mode="lines",
                       line=dict(width=0), showlegend=False, name="Upper CI"),
            go.Scatter(x=df_24["Time"], y=df_24["Lower CI"], mode="lines",
                       fill="tonexty", fillcolor="rgba(0,180,216,0.15)",
                       line=dict(width=0), name="Confidence Interval"),
            go.Scatter(x=df_24["Time"], y=df_24["Forecast"], mode="lines+markers",
                       line=dict(color="#00b4d8", width=2), name="Forecast"),
        ])
        fig_24.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
            xaxis_title="Time", yaxis_title="Requests",
        )
        st.plotly_chart(fig_24, use_container_width=True)

    with col_b:
        st.markdown("**7-Day Demand Forecast**")
        fig_7 = go.Figure([
            go.Scatter(x=df_7["Date"], y=df_7["Upper CI"], mode="lines",
                       line=dict(width=0), showlegend=False, name="Upper CI"),
            go.Scatter(x=df_7["Date"], y=df_7["Lower CI"], mode="lines",
                       fill="tonexty", fillcolor="rgba(255,140,0,0.15)",
                       line=dict(width=0), name="Confidence Interval"),
            go.Scatter(x=df_7["Date"], y=df_7["Forecast"], mode="lines+markers",
                       line=dict(color="#ff8c00", width=2), name="Forecast"),
        ])
        fig_7.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
            xaxis_title="Date", yaxis_title="Requests",
        )
        st.plotly_chart(fig_7, use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Pattern Analysis
# ══════════════════════════════════════════════════════════════════════════════
elif nav == "Pattern Analysis":
    st.subheader("Pattern Analysis")

    days_of_week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    hours = list(range(24))

    # Hourly heatmap: hour vs day of week
    heatmap_data = rng.integers(0, 12, size=(7, 24)).astype(float)
    # Simulate realistic peaks: weekday mornings and evenings
    for d in range(5): # Mon-Fri
        heatmap_data[d, 7:10] += rng.uniform(3, 6, 3)
        heatmap_data[d, 17:20] += rng.uniform(2, 5, 3)
    for d in range(5, 7): # Weekends
        heatmap_data[d, 10:14] += rng.uniform(2, 4, 4)

    df_heat = pd.DataFrame(heatmap_data, index=days_of_week, columns=hours)

    st.markdown("**Hourly Request Heatmap (Hour vs Day of Week)**")
    fig_heat = go.Figure(data=go.Heatmap(
        z=df_heat.values,
        x=[f"{h:02d}:00" for h in hours],
        y=days_of_week,
        colorscale="YlOrRd",
        showscale=True,
    ))
    fig_heat.update_layout(
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=10, b=10, l=10, r=10),
        xaxis_title="Hour of Day", yaxis_title="Day of Week",
    )
    st.plotly_chart(fig_heat, use_container_width=True)

    st.divider()
    col_peak, col_anomaly = st.columns(2)

    with col_peak:
        st.markdown("**Peak Hours**")
        hourly_avg = heatmap_data.mean(axis=0)
        df_peak = pd.DataFrame({"Hour": [f"{h:02d}:00" for h in hours], "Avg Requests": hourly_avg})
        fig_peak = px.bar(df_peak, x="Hour", y="Avg Requests",
                          color="Avg Requests", color_continuous_scale="Oranges")
        fig_peak.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
            showlegend=False, coloraxis_showscale=False,
        )
        st.plotly_chart(fig_peak, use_container_width=True)

    with col_anomaly:
        st.markdown("**Anomaly Detection (Simulated)**")
        anomaly_days = [datetime.now().date() - timedelta(days=i) for i in range(14, -1, -1)]
        anomaly_vals = 20 + 5 * np.sin(np.arange(15) * 0.8) + rng.normal(0, 2, 15)
        anomaly_flags = rng.random(15) > 0.85
        df_anom = pd.DataFrame({
            "Date": anomaly_days,
            "Requests": anomaly_vals,
            "Anomaly": anomaly_flags,
        })
        fig_anom = go.Figure()
        fig_anom.add_trace(go.Scatter(
            x=df_anom["Date"], y=df_anom["Requests"],
            mode="lines+markers", name="Requests",
            line=dict(color="#00b4d8"),
        ))
        anomalies = df_anom[df_anom["Anomaly"]]
        fig_anom.add_trace(go.Scatter(
            x=anomalies["Date"], y=anomalies["Requests"],
            mode="markers", name="Anomaly",
            marker=dict(color="red", size=12, symbol="x"),
        ))
        fig_anom.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
        )
        st.plotly_chart(fig_anom, use_container_width=True)

    st.divider()
    st.markdown("**Trend Analysis (Last 30 Days)**")
    trend_days = [datetime.now().date() - timedelta(days=i) for i in range(29, -1, -1)]
    trend_vals = 15 + np.linspace(0, 8, 30) + rng.normal(0, 2, 30)
    df_trend = pd.DataFrame({"Date": trend_days, "Requests": trend_vals})
    fig_trend = px.line(df_trend, x="Date", y="Requests",
                        color_discrete_sequence=["#06d6a0"])
    fig_trend.update_layout(
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=10, b=10, l=10, r=10),
    )
    st.plotly_chart(fig_trend, use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Data Quality
# ══════════════════════════════════════════════════════════════════════════════
elif nav == "Data Quality":
    st.subheader("Data Quality")

    # Quality metrics
    q1, q2, q3, q4 = st.columns(4)
    with q1:
        with st.container(border=True):
            st.metric("Completeness", "98.5%", "+0.3%")
    with q2:
        with st.container(border=True):
            st.metric("Consistency", "99.2%", "+0.1%")
    with q3:
        with st.container(border=True):
            st.metric("Accuracy", "97.8%", "-0.2%")
    with q4:
        with st.container(border=True):
            st.metric("Timeliness", "99.7%", "+0.5%")

    st.divider()

    col_trend, col_issues = st.columns([3, 2])

    with col_trend:
        st.markdown("**Quality Trends (Last 7 Days)**")
        q_days = [datetime.now().date() - timedelta(days=i) for i in range(6, -1, -1)]
        completeness = 97.5 + rng.uniform(-0.3, 0.5, 7).cumsum() * 0.2
        consistency = 98.8 + rng.uniform(-0.2, 0.3, 7).cumsum() * 0.1
        accuracy = 97.0 + rng.uniform(-0.4, 0.4, 7).cumsum() * 0.15
        df_qt = pd.DataFrame({
            "Date": q_days,
            "Completeness": np.clip(completeness, 95, 100),
            "Consistency": np.clip(consistency, 95, 100),
            "Accuracy": np.clip(accuracy, 95, 100),
        })
        fig_qt = go.Figure()
        for col, color in [("Completeness", "#00b4d8"), ("Consistency", "#06d6a0"), ("Accuracy", "#ff8c00")]:
            fig_qt.add_trace(go.Scatter(x=df_qt["Date"], y=df_qt[col],
                                        mode="lines+markers", name=col,
                                        line=dict(color=color, width=2)))
        fig_qt.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
            yaxis=dict(range=[94, 101], title="Score (%)"),
        )
        st.plotly_chart(fig_qt, use_container_width=True)

    with col_issues:
        st.markdown("**Open Issues**")
        issues = pd.DataFrame([
            {"Issue": "Missing patient phone", "Count": 3, "Severity": "Low"},
            {"Issue": "Duplicate request IDs", "Count": 1, "Severity": "High"},
            {"Issue": "Stale ambulance GPS", "Count": 2, "Severity": "Medium"},
            {"Issue": "Null hospital assignment", "Count": 4, "Severity": "Medium"},
        ])
        st.dataframe(issues, use_container_width=True)

    st.divider()
    st.markdown("**Data Freshness**")
    f1, f2, f3 = st.columns(3)
    with f1:
        with st.container(border=True):
            st.markdown("**Requests**")
            st.caption(f"Last updated: {datetime.now().strftime('%H:%M:%S')}")
            st.success("Fresh")
    with f2:
        with st.container(border=True):
            st.markdown("**Fleet GPS**")
            st.caption(f"Last updated: {(datetime.now() - timedelta(seconds=45)).strftime('%H:%M:%S')}")
            st.success("Fresh")
    with f3:
        with st.container(border=True):
            st.markdown("**Hospital Capacity**")
            st.caption(f"Last updated: {(datetime.now() - timedelta(minutes=3)).strftime('%H:%M:%S')}")
            st.warning("Slightly stale")


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Reports
# ══════════════════════════════════════════════════════════════════════════════
elif nav == "Reports":
    st.subheader("Reports")

    active_count = sum(1 for a in fleet if a.get("status") == "Active")

    st.markdown("### Executive Summary")

    r1, r2, r3, r4 = st.columns(4)
    total_requests = len(all_requests)
    resolved_rate = round(len(closed_requests) / max(total_requests, 1) * 100, 1)
    avg_delay = round(float(np.mean([r.get("mlDelayMins", 0) for r in all_requests])), 1)
    high_risk_pct = round(sum(1 for r in all_requests if r.get("mlRisk") == "High") / max(total_requests, 1) * 100, 1)

    with r1:
        with st.container(border=True):
            st.metric("Total Requests (30d)", total_requests)
    with r2:
        with st.container(border=True):
            st.metric("Resolution Rate", f"{resolved_rate}%")
    with r3:
        with st.container(border=True):
            st.metric("Avg ML ETA", f"{avg_delay} min")
    with r4:
        with st.container(border=True):
            st.metric("High Risk %", f"{high_risk_pct}%")

    st.divider()

    col_perf, col_comp = st.columns(2)

    with col_perf:
        st.markdown("**30-Day Performance Trends**")
        perf_days = [datetime.now().date() - timedelta(days=i) for i in range(29, -1, -1)]
        perf_requests = 12 + np.linspace(0, 6, 30) + rng.normal(0, 2, 30)
        perf_resolved = perf_requests * rng.uniform(0.75, 0.95, 30)
        df_perf = pd.DataFrame({
            "Date": perf_days,
            "Total Requests": np.clip(perf_requests, 0, None),
            "Resolved": np.clip(perf_resolved, 0, None),
        })
        fig_perf = go.Figure()
        fig_perf.add_trace(go.Scatter(x=df_perf["Date"], y=df_perf["Total Requests"],
                                      mode="lines+markers", name="Total Requests",
                                      line=dict(color="#00b4d8", width=2)))
        fig_perf.add_trace(go.Scatter(x=df_perf["Date"], y=df_perf["Resolved"],
                                      mode="lines+markers", name="Resolved",
                                      line=dict(color="#06d6a0", width=2)))
        fig_perf.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
        )
        st.plotly_chart(fig_perf, use_container_width=True)

    with col_comp:
        st.markdown("**Current vs Previous Period**")
        metrics_labels = ["Requests", "Resolved", "High Risk", "Avg ETA (min)"]
        current_vals = [total_requests, len(closed_requests), int(high_risk_pct), avg_delay]
        prev_vals = [
            int(total_requests * rng.uniform(0.8, 1.1)),
            int(len(closed_requests) * rng.uniform(0.75, 1.05)),
            int(high_risk_pct * rng.uniform(0.85, 1.15)),
            round(avg_delay * rng.uniform(0.9, 1.1), 1),
        ]
        fig_comp = go.Figure(data=[
            go.Bar(name="Current Period", x=metrics_labels, y=current_vals,
                   marker_color="#00b4d8"),
            go.Bar(name="Previous Period", x=metrics_labels, y=prev_vals,
                   marker_color="#adb5bd"),
        ])
        fig_comp.update_layout(
            barmode="group",
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
        )
        st.plotly_chart(fig_comp, use_container_width=True)

    st.divider()
    st.markdown("**Key Insights**")
    with st.container(border=True):
        st.markdown(f"- Request volume has increased by ~{int(rng.integers(8, 20))}% over the last 30 days.")
        st.markdown(f"- Average ML-estimated ETA is **{avg_delay} minutes**, within acceptable SLA.")
        st.markdown(f"- High-risk cases account for **{high_risk_pct}%** of all requests — monitor closely.")
        st.markdown(f"- Fleet utilization is at **{round(active_count / max(len(fleet), 1) * 100, 1)}%** capacity.")
        st.markdown(f"- All {len(hospitals)} hospitals are operational with beds available.")

    st.divider()
    st.markdown("**Export Data**")
    df_export = pd.DataFrame([{
        "ID": r.get("id","?"),
        "Created": r.get("createdAt","?"),
        "Type": r.get("emergencyType","?"),
        "Status": r.get("status","?"),
        "Patient": r.get("patientName","?"),
        "ML Risk": r.get("mlRisk","?"),
        "ML Delay (min)": r.get("mlDelayMins","?"),
        "Ambulance": r.get("ambulancePlate","N/A"),
        "Hospital": r.get("hospitalName","N/A"),
    } for r in all_requests])
    csv_data = df_export.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="Download All Requests as CSV",
        data=csv_data,
        file_name=f"eris_requests_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
        mime="text/csv",
    )
