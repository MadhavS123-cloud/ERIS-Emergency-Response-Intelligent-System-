import streamlit as st
import pandas as pd  # type: ignore
import requests as http_requests
import os
from datetime import datetime

BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")
API_BASE = f"{BACKEND_URL}/api/v1" if BACKEND_URL else ""
HEADERS = {"x-internal-token": "ERIS_INTERNAL", "Content-Type": "application/json"}


def _fetch_staff():
    """Fetch drivers and hospital staff from backend."""
    if not API_BASE:
        return None, "BACKEND_URL not configured"
    try:
        r = http_requests.get(f"{API_BASE}/admin/staff-accounts", headers=HEADERS, timeout=5)
        if r.status_code == 200:
            return r.json().get("data", {}), None
        return None, f"HTTP {r.status_code}: {r.text[:80]}"
    except Exception as e:
        return None, str(e)


def _reset_password(user_id: str, new_password: str):
    """Call backend to reset a user's password."""
    if not API_BASE:
        return False, "Backend not configured"
    try:
        r = http_requests.post(
            f"{API_BASE}/admin/staff-accounts/reset-password",
            json={"userId": user_id, "newPassword": new_password},
            headers=HEADERS,
            timeout=5
        )
        if r.status_code == 200:
            return True, r.json().get("message", "Done")
        return False, f"HTTP {r.status_code}: {r.text[:100]}"
    except Exception as e:
        return False, str(e)


def render_settings(data):
    st.subheader("System Settings & Configuration")
    is_live = data.get("live", False)

    t1, t2, t3, t4 = st.tabs(["👥 Staff Accounts", "🔗 API Integrations", "⚙️ Alert Thresholds", "📋 System Logs"])

    # ── Tab 1: Staff Accounts ─────────────────────────────────────────────────
    with t1:
        st.markdown("### Driver & Hospital Staff Accounts")
        st.caption("Login IDs (emails) and ambulance assignments. Passwords are bcrypt-hashed — use Reset to set a new one.")

        if not is_live:
            st.warning("⚠️ Connect BACKEND_URL to see real staff accounts. Demo mode shows placeholder data.", icon="📡")
            # Show placeholder demo
            st.markdown("#### 🚑 Drivers (Demo)")
            demo_drivers = pd.DataFrame([
                {"Name": "Ravi Kumar", "Email (Login ID)": "ravi@eris.local", "Phone": "9876543210",
                 "Assigned Ambulance": "KA-01-AMB-100", "Hospital": "Apollo Hospitals", "Status": "🔵 Active"},
                {"Name": "Suresh Nair", "Email (Login ID)": "suresh@eris.local", "Phone": "9876543211",
                 "Assigned Ambulance": "KA-02-AMB-101", "Hospital": "Manipal Hospital", "Status": "🟢 Available"},
            ])
            st.dataframe(demo_drivers, use_container_width=True, hide_index=True)
            return

        # Fetch live staff
        staff, error = _fetch_staff()

        if error:
            st.error(f"❌ Could not load staff accounts: {error}")
            return

        drivers = staff.get("drivers", [])
        hospitals = staff.get("hospitals", [])

        # ── DRIVERS ──────────────────────────────────────────────────────────
        st.markdown(f"#### 🚑 Drivers ({len(drivers)})")

        if not drivers:
            st.info("No driver accounts found. Register drivers via the backend auth endpoint.")
        else:
            for d in drivers:
                amb = d.get("ambulance") or {}
                hosp = amb.get("hospital") or {}
                amb_status = "🟢 Available" if amb.get("isAvailable") else "🔴 Deployed"

                with st.expander(f"👨‍✈️ {d.get('name', '?')} — {d.get('email', '?')}"):
                    c1, c2, c3 = st.columns([2, 2, 1])

                    with c1:
                        st.markdown("**Account Details**")
                        st.write(f"**Name:** {d.get('name', '—')}")
                        st.write(f"**Login Email:** `{d.get('email', '—')}`")
                        st.write(f"**Phone:** {d.get('phone') or '—'}")
                        st.caption(f"**User ID:** `{d.get('id', '?')}`")
                        created = d.get("createdAt", "")
                        if created:
                            try:
                                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                                st.caption(f"Created: {dt.strftime('%d %b %Y')}")
                            except Exception:
                                pass

                    with c2:
                        st.markdown("**Assigned Vehicle**")
                        if amb.get("plateNumber"):
                            st.write(f"**Ambulance:** `{amb.get('plateNumber')}`")
                            st.write(f"**Status:** {amb_status}")
                            st.write(f"**Hospital:** {hosp.get('name', '—')}")
                            st.caption(f"Ambulance ID: `{amb.get('id', '?')[:8]}`")
                        else:
                            st.warning("No ambulance linked")

                    with c3:
                        st.markdown("**🔑 Reset Password**")
                        new_pw = st.text_input(
                            "New password",
                            type="password",
                            key=f"pw_driver_{d.get('id')}",
                            placeholder="Min 6 chars"
                        )
                        if st.button("Reset", key=f"reset_driver_{d.get('id')}"):
                            if len(new_pw) < 6:
                                st.error("Min 6 characters")
                            else:
                                ok, msg = _reset_password(d.get("id"), new_pw)
                                if ok:
                                    st.success(f"✅ {msg}")
                                else:
                                    st.error(f"❌ {msg}")

        # ── Export drivers ────────────────────────────────────────────────────
        if drivers:
            st.markdown("**📥 Export Driver Accounts**")
            df_drivers = pd.DataFrame([{
                "Name": d.get("name", "?"),
                "Email (Login ID)": d.get("email", "?"),
                "Phone": d.get("phone") or "—",
                "User ID": d.get("id", "?"),
                "Ambulance": (d.get("ambulance") or {}).get("plateNumber") or "—",
                "Hospital": ((d.get("ambulance") or {}).get("hospital") or {}).get("name", "—"),
                "Ambulance Status": "Available" if (d.get("ambulance") or {}).get("isAvailable") else "Deployed",
                "Created": d.get("createdAt", "?")[:10] if d.get("createdAt") else "?",
            } for d in drivers])
            st.dataframe(df_drivers, use_container_width=True, hide_index=True)
            st.download_button("⬇️ Download CSV", df_drivers.to_csv(index=False), "drivers.csv", "text/csv")

        st.divider()

        # ── HOSPITAL STAFF ────────────────────────────────────────────────────
        st.markdown(f"#### 🏥 Hospital Staff Accounts ({len(hospitals)})")

        if not hospitals:
            st.info("No hospital staff accounts found.")
        else:
            for h in hospitals:
                hosp_info = h.get("hospital") or {}

                with st.expander(f"🏥 {h.get('name', '?')} — {h.get('email', '?')}"):
                    c1, c2, c3 = st.columns([2, 2, 1])

                    with c1:
                        st.markdown("**Account Details**")
                        st.write(f"**Name:** {h.get('name', '—')}")
                        st.write(f"**Login Email:** `{h.get('email', '—')}`")
                        st.write(f"**Phone:** {h.get('phone') or '—'}")
                        st.caption(f"**User ID:** `{h.get('id', '?')}`")
                        created = h.get("createdAt", "")
                        if created:
                            try:
                                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                                st.caption(f"Created: {dt.strftime('%d %b %Y')}")
                            except Exception:
                                pass

                    with c2:
                        st.markdown("**Linked Hospital**")
                        if hosp_info:
                            st.write(f"**Hospital:** {hosp_info.get('name', '—')}")
                            st.write(f"**Address:** {hosp_info.get('address', '—')}")
                            st.write(f"**Bed Capacity:** {hosp_info.get('bedCapacity', '—')}")
                            st.caption(f"Hospital ID: `{hosp_info.get('id', '?')[:8]}`")
                        else:
                            st.warning("No hospital facility linked")

                    with c3:
                        st.markdown("**🔑 Reset Password**")
                        new_pw = st.text_input(
                            "New password",
                            type="password",
                            key=f"pw_hosp_{h.get('id')}",
                            placeholder="Min 6 chars"
                        )
                        if st.button("Reset", key=f"reset_hosp_{h.get('id')}"):
                            if len(new_pw) < 6:
                                st.error("Min 6 characters")
                            else:
                                ok, msg = _reset_password(h.get("id"), new_pw)
                                if ok:
                                    st.success(f"✅ {msg}")
                                else:
                                    st.error(f"❌ {msg}")

        if hospitals:
            st.markdown("**📥 Export Hospital Staff**")
            df_hospitals = pd.DataFrame([{
                "Name": h.get("name", "?"),
                "Email (Login ID)": h.get("email", "?"),
                "Phone": h.get("phone") or "—",
                "User ID": h.get("id", "?"),
                "Hospital": (h.get("hospital") or {}).get("name", "—"),
                "Hospital ID": (h.get("hospital") or {}).get("id", "—"),
                "Created": h.get("createdAt", "?")[:10] if h.get("createdAt") else "?",
            } for h in hospitals])
            st.dataframe(df_hospitals, use_container_width=True, hide_index=True)
            st.download_button("⬇️ Download CSV", df_hospitals.to_csv(index=False), "hospital_staff.csv", "text/csv")

    # ── Tab 2: API Integrations ───────────────────────────────────────────────
    with t2:
        st.markdown("### Mapping & Location APIs")
        provider = st.selectbox("Active Map Provider", ["TomTom SDK", "Google Maps Platform", "Leaflet/OSM"])
        with st.form("api_key_form"):
            st.text_input("API Key", type="password", value="************************")
            st.caption(f"Configuring key for **{provider}**.")
            if st.form_submit_button("Update API Key"):
                st.success(f"{provider} API Key updated!")

        st.divider()
        st.markdown("### Backend Services")
        st.text_input("Main API Base URL", value=API_BASE or "Not configured")
        st.text_input("ML Insights Engine URL", value=os.getenv("ML_SERVICE_URL", "Not configured"))
        if st.button("Test Connections"):
            if not API_BASE:
                st.error("BACKEND_URL not set.")
            else:
                try:
                    r = http_requests.get(f"{API_BASE}/admin/dashboard-stats", headers=HEADERS, timeout=4)
                    if r.status_code == 200:
                        st.success("✅ Backend responding normally.")
                    else:
                        st.error(f"Backend returned {r.status_code}")
                except Exception as e:
                    st.error(f"Connection failed: {e}")

    # ── Tab 3: Alert Thresholds ───────────────────────────────────────────────
    with t3:
        st.markdown("### Alert Threshold Settings")
        delay_threshold = st.slider("High Delay Alert Threshold (Minutes)", 5, 60, 15)
        st.caption(f"Alerts triggered when ML ETA exceeds **{delay_threshold} minutes**.")
        traffic_multiplier = st.slider("Traffic Risk Multiplier", 1.0, 3.0, 1.5, 0.1)
        st.caption(f"High risk zone when congestion > **{traffic_multiplier}x** normal.")
        if st.button("Save Thresholds"):
            st.success("Alert configurations saved.")

    # ── Tab 4: System Logs ────────────────────────────────────────────────────
    with t4:
        st.markdown("### Admin System Logs")
        logs = []
        for r in data.get("requests", []):
            if r.get("createdAt"):
                try:
                    dt_str = r["createdAt"].replace("Z", "+00:00")
                    dt = datetime.fromisoformat(dt_str)
                    ts = dt.strftime("%Y-%m-%d %H:%M:%S")
                    req_id = r.get("id", "?")[:8].upper()
                    status = r.get("status", "")
                    if r.get("mlRisk") == "High" or r.get("isSuspicious"):
                        logs.append({"Timestamp": ts, "Level": "WARNING",
                                     "Message": f"High risk/suspicious emergency #{req_id}"})
                    if status == "COMPLETED":
                        logs.append({"Timestamp": ts, "Level": "INFO",
                                     "Message": f"Emergency #{req_id} COMPLETED"})
                    elif status == "PENDING":
                        logs.append({"Timestamp": ts, "Level": "INFO",
                                     "Message": f"New emergency #{req_id} received"})
                    elif status == "CANCELLED":
                        logs.append({"Timestamp": ts, "Level": "ERROR",
                                     "Message": f"Emergency #{req_id} CANCELLED"})
                    if r.get("isFake"):
                        logs.append({"Timestamp": ts, "Level": "ERROR",
                                     "Message": f"Request #{req_id} marked as FAKE by driver"})
                except Exception:
                    pass

        logs.sort(key=lambda x: x["Timestamp"], reverse=True)
        if not logs:
            logs = [{"Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                     "Level": "INFO", "Message": "System started. No recent logs."}]

        df_logs = pd.DataFrame(logs)

        def color_level(val):
            return f'color: {"red" if val == "ERROR" else "orange" if val == "WARNING" else "green"}'

        st.dataframe(df_logs.style.map(color_level, subset=["Level"]), use_container_width=True, hide_index=True)
        st.download_button("⬇️ Download Logs (CSV)", df_logs.to_csv(index=False), "system_logs.csv", "text/csv")
