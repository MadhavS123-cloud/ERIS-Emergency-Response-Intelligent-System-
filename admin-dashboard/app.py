import streamlit as st

AUTO_REFRESH_SECONDS = 300

# ── Page Config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="ERIS | Admin Intelligence Dashboard",
    page_icon="🚑",
    layout="wide",
    initial_sidebar_state="expanded",
)

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
import base64
import os

def get_base64_image(image_path):
    with open(image_path, "rb") as img_file:
        return base64.b64encode(img_file.read()).decode()

logo_path = os.path.join(os.path.dirname(__file__), "assets", "eris_logo.png")
try:
    logo_b64 = get_base64_image(logo_path)
    logo_src = f"data:image/png;base64,{logo_b64}"
except Exception:
    logo_src = "https://img.icons8.com/fluency/96/ambulance.png"

# ── Data & Status Setup ───────────────────────────────────────────────────────
if "data" not in st.session_state:
    st.session_state.data = load_data()

# Refresh data logic
def refresh_data(force_refresh=False):
    previous_data = st.session_state.get("data")
    fresh_data = load_data(force_refresh=force_refresh)

    if (
        previous_data
        and previous_data.get("live")
        and not fresh_data.get("live")
        and fresh_data.get("connection_error")
        and not force_refresh
    ):
        stale_data = dict(previous_data)
        stale_data["stale"] = True
        stale_data["connection_error"] = fresh_data.get("connection_error")
        stale_data["backend_url"] = fresh_data.get("backend_url", previous_data.get("backend_url"))
        st.session_state.data = stale_data
        return

    fresh_data["stale"] = False
    st.session_state.data = fresh_data

initial_data = st.session_state.data
all_requests = initial_data["requests"]
is_live = initial_data["live"]
is_stale = initial_data.get("stale", False)
backend_url = initial_data.get("backend_url", "Not set")

# ── Prominent Logo & Header ──────────────────────────────────────────────────
st.markdown(f"""
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; background: linear-gradient(90deg, rgba(255,75,75,0.1), transparent); padding: 20px; border-radius: 15px; border-left: 6px solid #ff4b4b;">
        <div style="display: flex; align-items: center;">
            <img src="{logo_src}" width="80" style="margin-right: 20px; filter: drop-shadow(0 0 15px rgba(255,75,75,0.4));">
            <div>
                <h1 style="margin: 0; font-size: 2.5rem; letter-spacing: -2px; font-weight: 800; line-height: 1; color: white;">ERIS <span style="color: #ff4b4b;">INTELLIGENCE</span></h1>
                <p style="margin: 0; font-size: 0.9rem; opacity: 0.8; text-transform: uppercase; letter-spacing: 3px; font-weight: 500;">Emergency Response Intelligent System | Global Node v2.1</p>
            </div>
        </div>
        <div style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end;">
                <div class="sync-indicator" style="background: {'#ffb703' if is_stale else ('#00ff00' if is_live else '#ff4b4b')};"></div>
                <span style="font-size: 0.75rem; color: {'#ffb703' if is_stale else ('#00ff00' if is_live else '#ff4b4b')}; font-weight: 800; letter-spacing: 1px;">
                    SYSTEM {'STALE' if is_stale else ('ONLINE' if is_live else 'OFFLINE')}
                </span>
            </div>
            <p style="margin: 0; font-size: 0.7rem; opacity: 0.5;">
                {'Showing last successful live snapshot' if is_stale else ('Secure Data Stream Active' if is_live else 'Using Simulated Data Feed')}
            </p>
        </div>
    </div>
""", unsafe_allow_html=True)

# ── Sidebar Setup ────────────────────────────────────────────────────────────
feed_count = len(st.session_state.get("live_dispatch_feed", []))
dispatch_badge = f" ({feed_count})" if feed_count > 0 else ""

with st.sidebar:
    st.image("assets/eris_logo.png", width=120)
    st.title("ERIS Admin")
    st.markdown("Global Command Console")
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
        active_count = sum(1 for r in all_requests if r.get("status") not in ("COMPLETED", "CANCELLED"))
        if is_stale:
            st.warning("Using last successful live snapshot while backend wakes up.")
            if initial_data.get("connection_error"):
                st.caption(f"❌ Latest refresh error: {initial_data['connection_error']}")
        else:
            st.markdown('<div class="sync-indicator"></div><span style="color:#00ff00; font-weight:600;">LIVE SYNC ACTIVE</span>', unsafe_allow_html=True)
        st.metric("Active Emergencies", active_count)
    else:
        st.error("● OFFLINE / DEMO MODE")
        if initial_data.get("connection_error"):
            st.caption(f"❌ Error: {initial_data['connection_error']}")
        st.info(f"🔗 URL: {backend_url}")
    st.caption(f"Auto refresh: every {AUTO_REFRESH_SECONDS // 60} minutes")
    if st.button("🔄 Refresh Now"):
        refresh_data(force_refresh=True)
        st.rerun()

@st.fragment(run_every=AUTO_REFRESH_SECONDS)
def render_main_data():
    # Progress scanline at the top of the data area
    st.markdown('<div style="width: 100%; height: 3px; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 10px; border-radius: 2px;"><div style="width: 30%; height: 100%; background: #ff4b4b; animation: scan 2s infinite ease-in-out;"></div></div>', unsafe_allow_html=True)
    
    # Reload fresh data inside the fragment
    refresh_data(force_refresh=False)
    current_data = st.session_state.data
    
    # Routing inside the fragment
    if nav == "COMMAND CENTER":
        render_overview(current_data)
    elif nav.startswith("🔴 LIVE DISPATCH"):
        render_dispatch_feed(current_data)
    elif nav == "LIVE TRACKING":
        render_live_tracking(current_data)
    elif nav == "REQUEST MANAGEMENT":
        render_request_management(current_data)
    elif nav == "FLEET & DRIVERS":
        render_fleet_management(current_data)
    elif nav == "ANALYTICS & ML":
        render_analytics(current_data)
    elif nav == "SYSTEM SETTINGS":
        render_settings(current_data)

# Launch the fragmented content
render_main_data()

# ── Footer ───────────────────────────────────────────────────────────────────
st.sidebar.divider()
st.sidebar.caption("© 2026 ERIS Global Intelligence v2.1")
