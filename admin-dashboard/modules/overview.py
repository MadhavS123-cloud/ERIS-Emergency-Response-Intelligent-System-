import streamlit as st
import pandas as pd # type: ignore
import plotly.express as px # type: ignore
from datetime import datetime, timedelta

def render_overview(data):
    st.subheader("Overview (Command Center)")

    all_requests = data["requests"]
    fleet = data["fleet"]
    hospitals = data["hospitals"]
    kpis = data["kpis"]

    active_requests = [r for r in all_requests if r.get("status") not in ("COMPLETED", "CANCELLED")]
    
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

    # Alerts Strip
    high_delays = [r for r in all_requests if r.get("mlDelayMins", 0) > 15 and r.get("status") not in ("COMPLETED", "CANCELLED")]
    no_amb_zones = [r for r in active_requests if not r.get("ambulancePlate")]
    
    a1, a2 = st.columns(2)
    with a1:
        if high_delays:
            st.error(f"🚨 {len(high_delays)} Emergencies with High Delays (>15 mins) detected!")
        else:
            st.success("✅ No high delay emergencies.")
    
    with a2:
        if no_amb_zones:
            st.warning(f"⚠️ {len(no_amb_zones)} Active Emergencies without an assigned Ambulance.")
        else:
            st.success("✅ All active emergencies have assigned units.")

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
            st.markdown("**Requests Over Last 24 Hours**")
            today = datetime.now()
            hours = [(today - timedelta(hours=i)).replace(minute=0, second=0, microsecond=0) for i in range(23, -1, -1)]
            counts = {h: 0 for h in hours}
            
            for r in all_requests:
                if r.get("createdAt"):
                    try:
                        dt_str = r["createdAt"].replace("Z", "+00:00")
                        dt = datetime.fromisoformat(dt_str)
                        hr_bin = dt.replace(minute=0, second=0, microsecond=0, tzinfo=None)
                        if hr_bin in counts:
                            counts[hr_bin] += 1
                    except Exception:
                        pass
                        
            df_hours = pd.DataFrame({"Time": list(counts.keys()), "Requests": list(counts.values())})
            fig_line = px.line(df_hours, x="Time", y="Requests", markers=True,
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
            st.metric("Busy/Active Units", fleet_summary.get("Active", 0))
    with fs2:
        with st.container(border=True):
            st.metric("Available Units", fleet_summary.get("Available", 0))
