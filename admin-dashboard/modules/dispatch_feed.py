"""
Live Dispatch Feed — ERIS Admin Dashboard.

Shows real-time emergency requests from the backend.
Data comes from two sources:
  1. REST API polling (via load_data — most reliable on Render)
  2. Socket.IO background thread (bonus real-time push when available)
"""
import streamlit as st
from datetime import datetime

_STATUS_COLOR = {
    "ACCEPTED":   "🟢",
    "EN_ROUTE":   "🔵",
    "IN_TRANSIT": "🟡",
    "COMPLETED":  "✅",
    "CANCELLED":  "🔴",
    "PENDING":    "🟠",
}

_RISK_COLOR = {
    "High":   "🔴",
    "Medium": "🟡",
    "Low":    "🟢",
}


def _time_ago(iso_ts: str) -> str:
    try:
        ts = iso_ts.replace("Z", "+00:00")
        dt = datetime.fromisoformat(ts)
        # Make offset-naive for comparison
        dt_naive = dt.replace(tzinfo=None)
        delta = (datetime.utcnow() - dt_naive).total_seconds()
        if delta < 60:
            return f"{int(delta)}s ago"
        if delta < 3600:
            return f"{int(delta // 60)}m ago"
        return f"{int(delta // 3600)}h ago"
    except Exception:
        return ""


def _render_request_card(r: dict, is_new: bool = False):
    """Render a single rich request card with all patient/driver/hospital info."""
    status = r.get("status", "PENDING")
    status_icon = _STATUS_COLOR.get(status, "⚪")
    risk = r.get("mlRisk") or r.get("mlDelayRisk") or "—"
    risk_icon = _RISK_COLOR.get(risk, "")
    req_id = (r.get("id") or "")[:8].upper()
    time_str = _time_ago(r.get("createdAt") or r.get("ts") or "")

    # Resolve all fields
    driver_name = r.get("driverName") or "Not yet assigned"
    driver_phone = r.get("driverPhone") or "—"
    amb_plate = r.get("ambulancePlate") or r.get("ambulanceId") or "—"
    hospital = r.get("hospitalName") or r.get("mlRecommendedHospitalName") or "Determining…"
    patient_name = r.get("patientName") or "Guest User"
    patient_phone = r.get("patientPhone") or "Not provided"
    pickup = r.get("pickupAddress") or "Unknown location"
    emergency_type = r.get("emergencyType") or "General Emergency"
    ml_delay = r.get("mlDelayMins") or r.get("mlExpectedDelay")
    is_suspicious = r.get("isSuspicious", False)
    is_fake = r.get("isFake", False)
    is_guest = r.get("isGuest", True)
    trust_score = r.get("trustScoreAtRequest")

    with st.container(border=True):
        # ── Header row ─────────────────────────────────────────────────────
        h1, h2, h3 = st.columns([4, 2, 2])
        with h1:
            badge = "🆕 NEW EMERGENCY" if is_new else f"{status_icon} {status}"
            flag = " 🚨 SUSPICIOUS" if is_suspicious else (" 🚫 FAKE" if is_fake else "")
            st.markdown(f"**{badge}{flag}** — `#{req_id}`")
        with h2:
            st.caption(f"⏱ {time_str}")
        with h3:
            st.caption(f"👤 {'Guest' if is_guest else 'Registered'} | Trust: {trust_score if trust_score is not None else '—'}")

        st.markdown("---")

        # ── Three column detail layout ──────────────────────────────────────
        c1, c2, c3 = st.columns(3)

        with c1:
            st.markdown("**🆘 Patient & Emergency**")
            st.write(f"**Type:** {emergency_type}")
            st.write(f"**Patient:** {patient_name}")
            st.write(f"**Phone:** {patient_phone}")
            st.write(f"**Pickup:** {pickup}")
            lat = r.get("locationLat")
            lng = r.get("locationLng")
            if lat and lng:
                st.caption(f"📍 GPS: {round(lat, 5)}, {round(lng, 5)}")

        with c2:
            st.markdown("**🚑 Dispatch Assignment**")
            assigned = driver_name != "Not yet assigned"
            if assigned:
                st.success(f"👨‍✈️ **Driver:** {driver_name}")
                st.write(f"📞 **Contact:** {driver_phone}")
                st.write(f"🚗 **Unit:** `{amb_plate}`")
                st.write(f"🏥 **Hospital:** {hospital}")
            else:
                st.warning("⏳ Awaiting ambulance assignment")
                if hospital != "Determining…":
                    st.write(f"🏥 Routed to: **{hospital}**")

        with c3:
            st.markdown("**📊 ML Intelligence**")
            st.write(f"Risk: {risk_icon} **{risk}**")
            if ml_delay is not None:
                st.write(f"ETA: ⏱ **{round(float(ml_delay), 1)} min**")
            else:
                st.write("ETA: *Calculating…*")

            ml_reasons = r.get("mlReasons") or []
            if ml_reasons:
                st.caption("**Factors:**")
                for reason in ml_reasons[:3]:
                    st.caption(f"• {reason}")

            if is_suspicious:
                st.error("⚠️ Flagged as Suspicious")
            if is_fake:
                st.error("🚫 Marked as Fake Request")


def render_dispatch_feed(data: dict = None):
    """
    Renders the real-time live dispatch feed panel.
    Uses REST data (from load_data) as primary + socket feed as overlay.
    """
    col_title, col_clear = st.columns([6, 1])
    with col_title:
        st.markdown("### 🚨 Live Dispatch Feed")
    with col_clear:
        if st.button("Clear Socket Feed", key="clear_dispatch_feed"):
            st.session_state.live_dispatch_feed = []
            st.rerun()

    is_live = data.get("live", False) if data else False

    # ── REST-based feed (primary — always works if backend is reachable) ────
    if data and data.get("requests"):
        rest_requests = data["requests"]
        # Show active first, sorted by newest
        active = [r for r in rest_requests if r.get("status") not in ("COMPLETED", "CANCELLED")]
        completed = [r for r in rest_requests if r.get("status") in ("COMPLETED", "CANCELLED")]

        if not is_live:
            st.warning(
                "⚠️ **Demo Mode** — Not connected to live backend. "
                "Data shown is simulated. Set `BACKEND_URL` in your Render environment to enable real data.",
                icon="📡"
            )
        else:
            st.success(f"✅ **Live Backend Connected** — {len(active)} active emergencies", icon="📡")

        if active:
            st.markdown(f"#### 🔴 Active Emergencies ({len(active)})")
            for r in active:
                _render_request_card(r, is_new=(r.get("status") == "PENDING"))
        else:
            st.info("No active emergencies right now.", icon="✅")

        if completed:
            with st.expander(f"📋 Recent Completed / Cancelled ({len(completed)})"):
                for r in completed:
                    _render_request_card(r, is_new=False)
    else:
        st.error("No request data available. Check backend connection.", icon="🔌")

    # ── Socket feed overlay (bonus real-time events) ────────────────────────
    socket_feed: list = st.session_state.get("live_dispatch_feed", [])
    if socket_feed:
        st.markdown("---")
        st.markdown(f"#### ⚡ Real-Time Socket Events ({len(socket_feed)})")
        for card in socket_feed[:10]:
            with st.container(border=True):
                h1, h2 = st.columns([5, 2])
                with h1:
                    is_new = card.get("event") == "new_emergency"
                    badge = "🆕 NEW" if is_new else f"{_STATUS_COLOR.get(card.get('status',''), '⚪')} UPDATE"
                    st.markdown(f"**{badge}** `#{card.get('requestId','?')}` — {card.get('emergencyType','?')}")
                with h2:
                    st.caption(_time_ago(card.get("ts", "")))

                c1, c2 = st.columns(2)
                with c1:
                    st.caption(f"👤 {card.get('patientName','?')}")
                    st.caption(f"📍 {card.get('pickupAddress','?')}")
                with c2:
                    driver = card.get("driverName", "—")
                    plate = card.get("ambulancePlate", "—")
                    hospital = card.get("hospitalName", "—")
                    if driver != "—":
                        st.caption(f"👨‍✈️ {driver} | 🚗 {plate}")
                        st.caption(f"🏥 {hospital}")
                    else:
                        st.caption("⏳ Awaiting assignment")
