import streamlit as st
import pandas as pd # type: ignore
import os
import requests as http_requests

BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")
API_BASE = f"{BACKEND_URL}/api/v1" if BACKEND_URL else ""

_STATUS_COLOR = {
    "ACCEPTED":   "🟢",
    "EN_ROUTE":   "🔵",
    "IN_TRANSIT": "🟡",
    "COMPLETED":  "✅",
    "CANCELLED":  "🔴",
    "PENDING":    "🟠",
}


def _update_status_api(request_id: str, new_status: str):
    """Call backend to update request status."""
    if not API_BASE:
        return False, "Backend not configured"
    try:
        resp = http_requests.patch(
            f"{API_BASE}/requests/{request_id}/status",
            json={"status": new_status},
            headers={"x-internal-token": "ERIS_INTERNAL"},
            timeout=5
        )
        if resp.status_code in (200, 201):
            return True, "Status updated successfully"
        return False, f"Backend error: {resp.status_code} — {resp.text[:100]}"
    except Exception as e:
        return False, str(e)


def render_request_management(data):
    st.subheader("Emergency Request Management")

    is_live = data.get("live", False)
    all_requests = data["requests"]

    if not is_live:
        st.warning("⚠️ Showing **demo data**. Connect BACKEND_URL in Render to see real requests.", icon="📡")

    # ── Filters ─────────────────────────────────────────────────────────────
    f1, f2, f3 = st.columns(3)
    with f1:
        status_filter = st.selectbox(
            "Filter by Status",
            ["All", "PENDING", "ACCEPTED", "EN_ROUTE", "IN_TRANSIT", "COMPLETED", "CANCELLED"]
        )
    with f2:
        risk_filter = st.selectbox("Filter by Risk", ["All", "High", "Medium", "Low"])
    with f3:
        guest_filter = st.selectbox("Patient Type", ["All", "Guest", "Registered"])

    filtered = all_requests
    if status_filter != "All":
        filtered = [r for r in filtered if r.get("status") == status_filter]
    if risk_filter != "All":
        filtered = [r for r in filtered if r.get("mlRisk") == risk_filter]
    if guest_filter == "Guest":
        filtered = [r for r in filtered if r.get("isGuest", True)]
    elif guest_filter == "Registered":
        filtered = [r for r in filtered if not r.get("isGuest", True)]

    # ── Summary metrics ──────────────────────────────────────────────────────
    pending = sum(1 for r in all_requests if r.get("status") == "PENDING")
    active = sum(1 for r in all_requests if r.get("status") not in ("COMPLETED", "CANCELLED", "PENDING"))
    high_risk = sum(1 for r in all_requests if r.get("mlRisk") == "High")
    suspicious = sum(1 for r in all_requests if r.get("isSuspicious") or r.get("isFake"))

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("🟠 Pending", pending, delta="Needs assignment" if pending else None)
    m2.metric("🔵 Active", active)
    m3.metric("🔴 High Risk", high_risk)
    m4.metric("⚠️ Suspicious", suspicious)

    st.markdown(f"**Showing {len(filtered)} of {len(all_requests)} requests**")
    st.divider()

    # ── Request Cards ─────────────────────────────────────────────────────────
    for r in filtered:
        req_id = r.get("id", "?")
        short_id = req_id[:8].upper() if len(req_id) >= 8 else req_id
        status = r.get("status", "PENDING")
        status_icon = _STATUS_COLOR.get(status, "⚪")
        risk = r.get("mlRisk", "?")
        risk_icon = {"High": "🔴", "Medium": "🟡", "Low": "🟢"}.get(risk, "⚪")
        patient = r.get("patientName", "?")
        etype = r.get("emergencyType", "?")
        is_suspicious = r.get("isSuspicious", False)
        is_fake = r.get("isFake", False)
        flag = " 🚨" if is_suspicious else (" 🚫" if is_fake else "")

        label = f"{status_icon} [{short_id}] {etype} — {patient}{flag} — {risk_icon} {risk} Risk"

        with st.expander(label):
            col1, col2, col3 = st.columns([2, 2, 1])

            # Patient info
            with col1:
                st.markdown("**👤 Patient Details**")
                st.write(f"**Name:** {r.get('patientName') or 'Guest User'}")
                st.write(f"**Email:** {r.get('patientEmail') or 'Not provided'}")
                st.write(f"**Phone:** {r.get('patientPhone') or 'Not provided'}")
                st.write(f"**Emergency:** {etype}")
                st.write(f"**Pickup:** {r.get('pickupAddress') or 'Unknown'}")
                lat = r.get("locationLat")
                lng = r.get("locationLng")
                if lat and lng:
                    st.caption(f"📍 {round(float(lat), 5)}, {round(float(lng), 5)}")
                trust = r.get("trustScoreAtRequest")
                guest = r.get("isGuest", True)
                st.caption(f"{'🙋 Guest' if guest else '👤 Registered'} | Trust: {trust if trust is not None else '—'}")

            # Dispatch info
            with col2:
                st.markdown("**🚑 Dispatch Info**")
                driver = r.get("driverName") or "Not assigned"
                driver_phone = r.get("driverPhone") or "—"
                driver_email = r.get("driverEmail") or "—"
                plate = r.get("ambulancePlate") or "—"
                hospital = r.get("hospitalName") or r.get("mlRecommendedHospitalName") or "Determining…"

                if r.get("ambulancePlate") or r.get("driverName"):
                    st.success(f"✅ Assigned")
                    st.write(f"**Driver:** {driver}")
                    st.write(f"**Email:** {driver_email}")
                    st.write(f"**Phone:** {driver_phone}")
                    st.write(f"**Ambulance:** `{plate}`")
                    st.write(f"**Hospital:** {hospital}")
                else:
                    st.warning("⏳ No ambulance assigned yet")
                    if hospital != "Determining…":
                        st.write(f"**Routed to:** {hospital}")

                st.markdown("---")
                st.markdown("**📊 ML Assessment**")
                st.write(f"Risk: {risk_icon} **{risk}**")
                delay = r.get("mlDelayMins") or r.get("mlExpectedDelay")
                if delay is not None:
                    st.write(f"ETA: ⏱ **{round(float(delay), 1)} min**")
                ml_reasons = r.get("mlReasons") or []
                if ml_reasons:
                    for reason in ml_reasons[:3]:
                        st.caption(f"• {reason}")

                if is_suspicious:
                    reason_text = r.get("suspiciousReason") or "Flagged by system"
                    st.error(f"⚠️ Suspicious: {reason_text}")
                if is_fake:
                    st.error("🚫 Marked as FAKE by driver")

            # Actions
            with col3:
                st.markdown("**⚡ Actions**")
                created_at = r.get("createdAt", "")
                if created_at:
                    try:
                        dt = created_at.replace("Z", "+00:00")
                        from datetime import datetime
                        dt_obj = datetime.fromisoformat(dt).replace(tzinfo=None)
                        mins_ago = int((datetime.utcnow() - dt_obj).total_seconds() // 60)
                        st.caption(f"🕐 {mins_ago}m ago")
                    except Exception:
                        st.caption(f"🕐 {created_at[:16]}")

                st.write(f"**Status:** {status_icon} {status}")

                if is_live:
                    new_status = st.selectbox(
                        "Change Status",
                        ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_TRANSIT", "COMPLETED", "CANCELLED"],
                        index=["PENDING", "ACCEPTED", "EN_ROUTE", "IN_TRANSIT", "COMPLETED", "CANCELLED"].index(status)
                            if status in ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_TRANSIT", "COMPLETED", "CANCELLED"] else 0,
                        key=f"status_{req_id}"
                    )
                    if new_status != status:
                        if st.button("✅ Apply", key=f"apply_{req_id}"):
                            ok, msg = _update_status_api(req_id, new_status)
                            if ok:
                                st.success(msg)
                                st.rerun()
                            else:
                                st.error(msg)
                else:
                    st.info("Status updates\nrequire live\nbackend.")

    st.divider()

    # ── Export Table ──────────────────────────────────────────────────────────
    st.markdown("**📥 Export Request Data**")
    df_export = pd.DataFrame([{
        "ID": r.get("id", "?")[:8].upper(),
        "Status": r.get("status", "?"),
        "Emergency": r.get("emergencyType", "?"),
        "Patient": r.get("patientName", "?"),
        "Patient Email": r.get("patientEmail", "—"),
        "Patient Phone": r.get("patientPhone", "—"),
        "Driver": r.get("driverName", "—"),
        "Driver Email": r.get("driverEmail", "—"),
        "Driver Phone": r.get("driverPhone", "—"),
        "Ambulance": r.get("ambulancePlate", "—"),
        "Hospital": r.get("hospitalName") or r.get("mlRecommendedHospitalName", "—"),
        "ML Risk": r.get("mlRisk", "?"),
        "ETA (min)": r.get("mlDelayMins") or r.get("mlExpectedDelay") or "—",
        "Suspicious": r.get("isSuspicious", False),
        "Fake": r.get("isFake", False),
        "Created": r.get("createdAt", "?")[:16] if r.get("createdAt") else "?",
    } for r in all_requests])

    st.dataframe(df_export, use_container_width=True, hide_index=True)
