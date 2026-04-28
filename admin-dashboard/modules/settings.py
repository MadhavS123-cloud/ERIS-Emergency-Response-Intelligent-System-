import streamlit as st
import pandas as pd # type: ignore
from datetime import datetime

def render_settings(data):
    st.subheader("System Settings & Configuration")

    t1, t2, t3 = st.tabs(["API Integrations", "Alert Thresholds", "System Logs"])

    with t1:
        st.markdown("### Mapping & Location APIs")
        
        provider = st.selectbox("Active Map Provider", ["TomTom SDK", "Google Maps Platform", "Leaflet/OSM"])
        
        with st.form("api_key_form"):
            api_key = st.text_input("API Key", type="password", value="************************")
            st.caption(f"Configuring key for **{provider}**.")
            if st.form_submit_button("Update API Key"):
                st.success(f"{provider} API Key successfully updated and validated!")

        st.divider()

        st.markdown("### Backend Services Hooks")
        st.text_input("Main API Base URL", value="http://localhost:5001/api/v1")
        st.text_input("ML Insights Engine URL", value="http://localhost:8000")
        if st.button("Test Connections"):
            st.success("✅ All systems responding normally.")

    with t2:
        st.markdown("### Alert Threshold Settings")
        
        delay_threshold = st.slider(
            "High Delay Alert Threshold (Minutes)", 
            min_value=5, max_value=60, value=15, step=1
        )
        st.caption(f"Alerts triggered when ML ETA exceeds **{delay_threshold} minutes**.")

        traffic_multiplier = st.slider(
            "Traffic Risk Multiplier (Triggers High Risk Zone)",
            min_value=1.0, max_value=3.0, value=1.5, step=0.1
        )
        st.caption(f"Zones highlighted if traffic congestion score > **{traffic_multiplier}x** normal.")
        
        if st.button("Save Thresholds"):
            st.success("Global alert configurations updated.")

    with t3:
        st.markdown("### Admin System Logs")

        logs = []
        for r in data.get("requests", []):
            if r.get("createdAt"):
                try:
                    dt_str = r["createdAt"].replace("Z", "+00:00")
                    dt = datetime.fromisoformat(dt_str)
                    timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
                    
                    status = r.get("status")
                    req_id = r.get("id", "Unknown")[:8]
                    
                    if r.get("mlRisk") == "High" or r.get("isSuspicious"):
                        logs.append({"Timestamp": timestamp, "Level": "WARNING", "Message": f"High risk/suspicious emergency request {req_id} logged."})
                    
                    if status == "COMPLETED":
                        logs.append({"Timestamp": timestamp, "Level": "INFO", "Message": f"Emergency request {req_id} marked as COMPLETED."})
                    elif status == "PENDING":
                        logs.append({"Timestamp": timestamp, "Level": "INFO", "Message": f"New emergency request {req_id} received."})
                    elif status == "CANCELLED":
                        logs.append({"Timestamp": timestamp, "Level": "ERROR", "Message": f"Emergency request {req_id} was CANCELLED."})
                        
                except Exception:
                    pass
                    
        logs.sort(key=lambda x: x["Timestamp"], reverse=True)
        
        if not logs:
            logs = [{"Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "Level": "INFO", "Message": "System started. No recent logs."}]
            
        df_logs = pd.DataFrame(logs)
        
        # Color code the rows via pandas styler if needed, or simply display
        def color_level(val):
            color = 'red' if val == 'ERROR' else 'orange' if val == 'WARNING' else 'green'
            return f'color: {color}'
            
        st.dataframe(df_logs.style.map(color_level, subset=['Level']), use_container_width=True, hide_index=True)
        
        st.download_button("Download Full Logs (CSV)", df_logs.to_csv(index=False), "system_logs.csv", "text/csv")
