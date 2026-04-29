import streamlit as st
import pandas as pd # type: ignore

def render_request_management(data):
    st.subheader("Emergency Request Management")

    all_requests = data["requests"]

    # Session state for tracking simulated status changes
    if "request_updates" not in st.session_state:
        st.session_state.request_updates = {}

    status_filter = st.selectbox("Filter by Status", ["All", "PENDING", "ACCEPTED", "EN_ROUTE", "IN_TRANSIT", "COMPLETED", "CANCELLED"])

    filtered_reqs = all_requests
    if status_filter != "All":
        filtered_reqs = [r for r in all_requests if r.get("status") == status_filter]

    st.markdown(f"**Showing {len(filtered_reqs)} Requests**")

    # Display as an interactive dataframe or expanders
    for r in filtered_reqs:
        req_id = r.get("id")
        # Apply any session updates
        display_status = st.session_state.request_updates.get(req_id, r.get("status", "PENDING"))
        
        risk_color = {"High": "🔴 HIGH", "Medium": "🟡 MED", "Low": "🟢 LOW"}.get(r.get("mlRisk", "Low"), "—")
        label = f"{risk_color} [{req_id[:8]}] {r.get('emergencyType','?')} — {r.get('patientName','?')} — {display_status}"
        
        with st.expander(label):
            col1, col2, col3 = st.columns([2, 2, 1])
            with col1:
                st.write(f"**ID:** `{req_id}`")
                st.write(f"**Emergency Type:** {r.get('emergencyType','?')}")
                st.write(f"**Patient Details:** {r.get('patientName','?')} ({r.get('patientPhone', 'N/A')})")
                st.write(f"**Pickup:** {r.get('pickupAddress', 'N/A')}")
            with col2:
                st.write(f"**ML Risk:** {r.get('mlRisk','?')}")
                st.write(f"**ML Delay Estimate:** {r.get('mlDelayMins','?')} min")
                amb_plate = r.get('ambulancePlate') or 'Not assigned'
                driver = r.get('driverName') or 'Not assigned'
                driver_phone = r.get('driverPhone') or '—'
                st.write(f"**Assigned Ambulance:** {amb_plate}")
                st.write(f"**Driver:** {driver} ({driver_phone})")
                hospital = r.get('hospitalName') or r.get('mlRecommendedHospitalName') or 'N/A'
                st.write(f"**Hospital:** {hospital}")
            with col3:
                st.write("**Actions**")
                # Simulated actions updating session state
                if st.button("Assign Nearest Unit", key=f"assign_{req_id}", disabled=bool(r.get('ambulancePlate'))):
                    st.success("Dispatch command sent!")
                
                new_status = st.selectbox("Update Status", 
                                          ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_TRANSIT", "COMPLETED", "CANCELLED"], 
                                          index=["PENDING", "ACCEPTED", "EN_ROUTE", "IN_TRANSIT", "COMPLETED", "CANCELLED"].index(display_status),
                                          key=f"status_{req_id}")
                if new_status != display_status:
                    st.session_state.request_updates[req_id] = new_status
                    st.rerun()

            if r.get("mlReasons"):
                st.caption("AI Insights: " + " | ".join(r["mlReasons"]))

    st.divider()

    # Raw Data Table Export
    st.markdown("**Export Raw Request Data**")
    df_export = pd.DataFrame([{
        "ID": r.get("id","?"),
        "Type": r.get("emergencyType","?"),
        "Status": st.session_state.request_updates.get(r.get("id"), r.get("status","?")),
        "Patient": r.get("patientName","?"),
        "ML Risk": r.get("mlRisk","?"),
        "Ambulance": r.get("ambulancePlate","N/A"),
    } for r in all_requests])
    
    st.dataframe(df_export, use_container_width=True)
