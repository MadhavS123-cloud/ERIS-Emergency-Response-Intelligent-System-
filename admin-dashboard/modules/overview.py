import streamlit as st
import pandas as pd # type: ignore
import plotly.express as px # type: ignore
from datetime import datetime, timedelta

_STATUS_COLOR = {
    "ACCEPTED":   "🟢",
    "EN_ROUTE":   "🔵",
    "IN_TRANSIT": "🟡",
    "COMPLETED":  "✅",
    "CANCELLED":  "🔴",
    "PENDING":    "🟠",
}


def render_overview(data):
    st.subheader("Command Center Overview")

    all_requests = data["requests"]
    fleet = data["fleet"]
    hospitals = data["hospitals"]
    is_live = data.get("live", False)
    is_stale = data.get("stale", False)

    if is_stale:
        st.warning(
            "⚠️ **Live Snapshot (Stale)** — Showing the last successful backend response while the service wakes up.",
            icon="🕒"
        )
    elif not is_live:
        st.warning(
            "⚠️ **Demo Mode** — Showing simulated data. "
            "Set `BACKEND_URL` in Render environment to see real emergency requests.",
            icon="📡"
        )

    active_requests = [r for r in all_requests if r.get("status") not in ("COMPLETED", "CANCELLED")]
    pending_requests = [r for r in all_requests if r.get("status") == "PENDING"]

    # ── KPI Cards ─────────────────────────────────────────────────────────────
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        with st.container(border=True):
            st.metric("🔴 Active Emergencies", len(active_requests),
                      delta=f"+{len(pending_requests)} pending" if pending_requests else None)
    with c2:
        with st.container(border=True):
            high_risk = sum(1 for r in all_requests if r.get("mlRisk") == "High")
            st.metric("⚠️ High Risk Cases", high_risk)
    with c3:
        with st.container(border=True):
            available = sum(1 for a in fleet if a.get("isAvailable"))
            st.metric("🚑 Available Ambulances", available)
    with c4:
        with st.container(border=True):
            total_beds = sum(
                h.get("icuBedsAvailable", 0) + h.get("generalBedsAvailable", 0)
                for h in hospitals
            )
            st.metric("🏥 Beds Available", total_beds)

    st.divider()

    # ── Critical Alerts ───────────────────────────────────────────────────────
    if pending_requests:
        st.error(
            f"🚨 **{len(pending_requests)} PENDING request(s) have NO ambulance assigned!** "
            "Go to Request Management to assign.",
            icon="🚨"
        )

    suspicious = [r for r in active_requests if r.get("isSuspicious") or r.get("isFake")]
    if suspicious:
        st.warning(f"⚠️ {len(suspicious)} suspicious/fake request(s) detected among active cases.")

    high_delays = [r for r in all_requests if (r.get("mlDelayMins") or 0) > 15 and r.get("status") not in ("COMPLETED", "CANCELLED")]
    if high_delays:
        st.warning(f"⏱ {len(high_delays)} emergencies predicted with delay > 15 mins.")

    if not pending_requests and not suspicious and not high_delays:
        st.success("✅ All systems nominal — no critical alerts.")

    st.divider()

    # ── Live Active Requests Table ────────────────────────────────────────────
    if active_requests:
        st.markdown(f"#### 🔴 Active Emergencies (Live)")
        for r in active_requests:
            req_id = (r.get("id") or "")[:8].upper()
            status = r.get("status", "PENDING")
            status_icon = _STATUS_COLOR.get(status, "⚪")
            patient = r.get("patientName") or "Guest"
            patient_phone = r.get("patientPhone") or "—"
            patient_email = r.get("patientEmail") or "—"
            etype = r.get("emergencyType") or "?"
            driver = r.get("driverName") or "—"
            driver_phone = r.get("driverPhone") or "—"
            driver_email = r.get("driverEmail") or "—"
            plate = r.get("ambulancePlate") or "—"
            hospital = r.get("hospitalName") or r.get("mlRecommendedHospitalName") or "—"
            hospital_email = r.get("hospitalEmail") or "—"
            risk = r.get("mlRisk") or "—"
            risk_icon = {"High": "🔴", "Medium": "🟡", "Low": "🟢"}.get(risk, "")
            delay = r.get("mlDelayMins") or r.get("mlExpectedDelay")
            pickup = r.get("pickupAddress") or "—"

            with st.container(border=True):
                h1, h2, h3, h4 = st.columns([2, 2, 2, 1])
                with h1:
                    st.markdown(f"{status_icon} **{status}** — `#{req_id}`")
                    st.write(f"**{etype}**")
                    st.caption(f"📍 {pickup[:50]}…" if len(pickup) > 50 else f"📍 {pickup}")
                with h2:
                    st.markdown("**👤 Patient**")
                    st.write(f"{patient}")
                    st.caption(f"📧 {patient_email}")
                    st.caption(f"📞 {patient_phone}")
                with h3:
                    st.markdown("**🚑 Dispatch**")
                    if driver != "—":
                        st.write(f"👨‍✈️ {driver}")
                        st.caption(f"📧 {driver_email}")
                        st.caption(f"📞 {driver_phone}")
                        st.write(f"🚗 `{plate}` | 🏥 {hospital}")
                        if hospital_email != "—":
                            st.caption(f"🏥 📧 {hospital_email}")
                    else:
                        st.warning("⏳ Unassigned")
                        if hospital != "—":
                            st.caption(f"🏥 Routing: {hospital}")
                            if hospital_email != "—":
                                st.caption(f"🏥 📧 {hospital_email}")
                with h4:
                    st.markdown("**📊 ML**")
                    st.write(f"{risk_icon} {risk}")
                    if delay:
                        st.caption(f"⏱ ~{round(float(delay), 1)}m")

        st.divider()

    # ── Charts ────────────────────────────────────────────────────────────────
    col_left, col_right = st.columns(2)

    with col_left:
        with st.container(border=True):
            st.markdown("**Requests by Emergency Type**")
            type_counts = {}
            for r in all_requests:
                t = r.get("emergencyType", "Other")
                type_counts[t] = type_counts.get(t, 0) + 1
            if type_counts:
                df_types = pd.DataFrame(list(type_counts.items()), columns=["Type", "Count"])
                fig_bar = px.bar(df_types, x="Type", y="Count", color="Type",
                                 color_discrete_sequence=px.colors.qualitative.Bold)
                fig_bar.update_layout(
                    plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                    showlegend=False, margin=dict(t=10, b=10, l=10, r=10),
                )
                st.plotly_chart(fig_bar, use_container_width=True)

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

    # ── Fleet Summary ─────────────────────────────────────────────────────────
    st.markdown("**Fleet Status Summary**")
    fleet_summary = {}
    for a in fleet:
        s = a.get("status", "Available")
        fleet_summary[s] = fleet_summary.get(s, 0) + 1
    fs_cols = st.columns(len(fleet_summary) or 1)
    for i, (status, count) in enumerate(fleet_summary.items()):
        with fs_cols[i]:
            with st.container(border=True):
                icon = "🔵" if status == "Active" else "🟢"
                st.metric(f"{icon} {status}", count)
