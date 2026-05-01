"""
Real-time Socket.IO listener for ERIS Admin Dashboard.

Runs a background thread that maintains a persistent WebSocket connection
to the backend. When a new_emergency or request_updated event is received,
it appends to `st.session_state.live_dispatch_feed` so the dashboard
re-renders the latest dispatch assignment immediately.
"""
import threading
import os
from datetime import datetime

# Maximum events to keep in the feed before rolling
MAX_FEED_SIZE = 50

_listener_thread = None
_sio = None


def _build_dispatch_card(event_name: str, payload: dict) -> dict:
    """Convert a raw backend event payload into a readable dispatch card."""
    ambulance    = payload.get("ambulance") or {}
    driver       = ambulance.get("driver") or {}
    hospital     = ambulance.get("hospital") or {}
    patient      = payload.get("patient") or {}

    return {
        "ts":             datetime.utcnow().isoformat(),
        "event":          event_name,
        "requestId":      (payload.get("id") or "")[:8],
        "emergencyType":  payload.get("emergencyType") or "Unknown",
        "patientName":    payload.get("patientName") or "Guest",
        "status":         payload.get("status") or "PENDING",
        "pickupAddress":  payload.get("pickupAddress") or "Unknown Location",
        "locationLat":    payload.get("locationLat"),
        "locationLng":    payload.get("locationLng"),
        # ── Assignment info ────────────────────────────────────────────────
        "driverName":     driver.get("name") or payload.get("driverName") or "—",
        "driverEmail":    driver.get("email") or payload.get("driverEmail") or "—",
        "ambulancePlate": ambulance.get("plateNumber") or payload.get("ambulancePlate") or "—",
        "hospitalName":   hospital.get("name") or payload.get("hospitalName") or "—",
        "hospitalEmail":  (
            payload.get("hospitalEmail")
            or next((staff.get("email") for staff in (hospital.get("staff") or []) if staff.get("email")), None)
            or "—"
        ),
        "patientEmail":   patient.get("email") or payload.get("patientEmail") or "—",
        "mlRisk":         payload.get("mlDelayRisk") or payload.get("mlRisk") or "—",
        "mlDelayMins":    payload.get("mlExpectedDelay") or payload.get("mlDelayMins") or None,
        "isSuspicious":   payload.get("isSuspicious") or False,
        "isFake":         payload.get("isFake") or False,
    }


def _start_listener(backend_url: str, session_state):
    """Connect to backend Socket.IO and listen for emergency events."""
    global _sio
    try:
        import socketio # type: ignore
    except ImportError:
        return  # Library not installed — silent fail

    _sio = socketio.Client(reconnection=True, reconnection_attempts=10, logger=False, engineio_logger=False)

    @_sio.event
    def connect():
        pass  # Connected silently

    @_sio.event
    def disconnect():
        pass

    @_sio.on("new_emergency")
    def on_new_emergency(data):
        card = _build_dispatch_card("new_emergency", data)
        _append_to_feed(session_state, card)

    @_sio.on("request_updated")
    def on_request_updated(data):
        # Only surface meaningful status changes (not every minor db touch)
        if data.get("status") in ("ACCEPTED", "EN_ROUTE", "IN_TRANSIT", "COMPLETED", "CANCELLED"):
            card = _build_dispatch_card("request_updated", data)
            _append_to_feed(session_state, card)

    try:
        _sio.connect(backend_url, transports=["websocket"])
        _sio.wait()
    except Exception:
        pass  # Backend offline — silent fail


def _append_to_feed(session_state, card: dict):
    """Thread-safe append to the dispatch feed list in session_state."""
    try:
        if not hasattr(session_state, "live_dispatch_feed"):
            session_state.live_dispatch_feed = []
        # Prepend newest first
        session_state.live_dispatch_feed.insert(0, card)
        # Keep rolling window
        session_state.live_dispatch_feed = session_state.live_dispatch_feed[:MAX_FEED_SIZE]
    except Exception:
        pass


def ensure_listener_running(session_state):
    """
    Called once per Streamlit session. Starts the background listener
    thread if it is not already running.
    """
    global _listener_thread

    if _listener_thread is not None and _listener_thread.is_alive():
        return  # Already running

    # Initialise feed if not present
    if not hasattr(session_state, "live_dispatch_feed"):
        session_state.live_dispatch_feed = []

    backend_url = os.getenv("BACKEND_URL", "http://localhost:5001")

    _listener_thread = threading.Thread(
        target=_start_listener,
        args=(backend_url, session_state),
        daemon=True,
        name="eris-socket-listener",
    )
    _listener_thread.start()
