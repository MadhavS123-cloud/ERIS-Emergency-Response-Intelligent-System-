"""
Live Dispatch Feed module for ERIS Admin Dashboard.

Renders a real-time assignment panel showing which driver from which
hospital was dispatched for each incoming emergency.
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
        dt = datetime.fromisoformat(iso_ts)
        delta = (datetime.utcnow() - dt).total_seconds()
        if delta < 60:
            return f"{int(delta)}s ago"
        if delta < 3600:
            return f"{int(delta // 60)}m ago"
        return f"{int(delta // 3600)}h ago"
    except Exception:
        return ""


def render_dispatch_feed():
    """
    Renders the real-time live dispatch feed panel.
    Reads from st.session_state.live_dispatch_feed populated by
    utils.socket_listener running in the background.
    """
    feed: list = st.session_state.get("live_dispatch_feed", [])

    col_title, col_clear = st.columns([6, 1])
    with col_title:
        st.markdown("### 🚨 Live Dispatch Feed")
    with col_clear:
        if st.button("Clear", key="clear_dispatch_feed"):
            st.session_state.live_dispatch_feed = []
            st.rerun()

    if not feed:
        st.info(
            "**No live events yet.** Waiting for emergency requests from the field…\n\n"
            "When a user presses the One-Click Emergency button, the dispatch assignment "
            "(driver name, ambulance plate, hospital) will appear here instantly.",
            icon="📡",
        )
        return

    for card in feed:
        status_icon = _STATUS_COLOR.get(card.get("status", ""), "⚪")
        risk_icon   = _RISK_COLOR.get(card.get("mlRisk", ""), "")
        is_new      = card.get("event") == "new_emergency"

        border_color = "#ff4b4b" if is_new else "#1f77b4"

        with st.container(border=True):
            h1, h2 = st.columns([5, 2])
            with h1:
                badge = "🆕 NEW EMERGENCY" if is_new else f"{status_icon} STATUS UPDATE"
                st.markdown(f"**{badge}** — `{card.get('requestId', '?')}`")
            with h2:
                ts_str = _time_ago(card.get("ts", ""))
                st.caption(ts_str)

            c1, c2, c3 = st.columns(3)

            with c1:
                st.markdown("**🆘 Emergency**")
                st.write(f"{card.get('emergencyType', '—')}")
                st.caption(f"👤 {card.get('patientName', '—')}")
                st.caption(f"📍 {card.get('pickupAddress', '—')}")

            with c2:
                st.markdown("**🚑 Dispatch**")
                driver_name = card.get("driverName", "—")
                plate       = card.get("ambulancePlate", "—")
                hospital    = card.get("hospitalName", "—")

                if driver_name != "—":
                    st.write(f"👨‍✈️ **Driver:** {driver_name}")
                    st.write(f"🚗 **Unit:** `{plate}`")
                    st.write(f"🏥 **Hospital:** {hospital}")
                else:
                    st.warning("⏳ Awaiting ambulance assignment…")

            with c3:
                st.markdown("**📊 ML Assessment**")
                st.write(f"Risk: {risk_icon} {card.get('mlRisk', '—')}")
                delay = card.get("mlDelayMins")
                if delay is not None:
                    st.write(f"ETA: ⏱ {delay} min")
                status = card.get("status", "—")
                st.write(f"Status: {_STATUS_COLOR.get(status, '⚪')} {status}")
                if card.get("isSuspicious"):
                    st.error("⚠️ Flagged as Suspicious")
                if card.get("isFake"):
                    st.error("🚫 Marked as Fake")
