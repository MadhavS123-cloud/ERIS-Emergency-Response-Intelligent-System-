import streamlit as st

# ── Page Config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="ERIS | Admin Intelligence Dashboard",
    page_icon="🚑",
    layout="wide",
    initial_sidebar_state="expanded",
)

from streamlit_autorefresh import st_autorefresh
from utils.data_loader import load_data
from utils.styling import load_css
from utils.socket_listener import ensure_listener_running
from modules.overview import render_overview
from modules.live_tracking import render_live_tracking
from modules.request_management import render_request_management
from modules.fleet_management import render_fleet_management
from modules.analytics import render_analytics
from modules.settings import render_settings
from modules.dispatch_feed import render_dispatch_feed

# ── Start real-time Socket.IO listener (background thread) ────────────────────
ensure_listener_running(st.session_state)

# ── Data & Styling ────────────────────────────────────────────────────────────
load_css()
# Auto-refresh every 15 seconds for near-real-time feel
st_autorefresh(interval=15 * 1000, key="data_refresh")

data = load_data()
all_requests = data["requests"]
is_live = data["live"]

# ── Live dispatch badge count ─────────────────────────────────────────────────
feed_count = len(st.session_state.get("live_dispatch_feed", []))
dispatch_badge = f" ({feed_count})" if feed_count > 0 else ""

# ── Sidebar Navigation ─────────────────────────────────────────────────────────
with st.sidebar:
    st.image("https://img.icons8.com/fluency/96/ambulance.png", width=80)
    st.title("ERIS Admin")
    st.markdown("Emergency Response Intelligence System")
    st.divider()

    nav = st.radio(
        "Main Navigation",
        [
            "COMMAND CENTER",
            f"🔴 LIVE DISPATCH{dispatch_badge}",
            "LIVE TRACKING",
            "REQUEST MANAGEMENT",
            "FLEET & DRIVERS",
            "ANALYTICS & ML",
            "SYSTEM SETTINGS"
        ]
    )

    st.divider()
    if is_live:
        st.success("● System Online: Live Data")
    else:
        st.info("● Demo Mode: Mock Data")

    st.caption(f"Last updated: {st.session_state.get('data_refresh', 0)}")
    if st.button("Manual Sync"):
        st.cache_data.clear()
        st.rerun()

# ── Main Content Routing ─────────────────────────────────────────────────────
if nav == "COMMAND CENTER":
    render_overview(data)
elif nav.startswith("🔴 LIVE DISPATCH"):
    render_dispatch_feed()
elif nav == "LIVE TRACKING":
    render_live_tracking(data)
elif nav == "REQUEST MANAGEMENT":
    render_request_management(data)
elif nav == "FLEET & DRIVERS":
    render_fleet_management(data)
elif nav == "ANALYTICS & ML":
    render_analytics(data)
elif nav == "SYSTEM SETTINGS":
    render_settings(data)

# ── Footer ───────────────────────────────────────────────────────────────────
st.sidebar.divider()
st.sidebar.caption("© 2026 ERIS Intelligent Systems v2.1")
