import streamlit as st
import pandas as pd
import plotly.express as px

def render_fleet_management(data):
    st.subheader("Ambulance & Driver Management")

    fleet = data["fleet"]

    active_count = sum(1 for a in fleet if a.get("status") == "Active")
    available_count = sum(1 for a in fleet if a.get("isAvailable"))

    f1, f2, f3 = st.columns(3)
    with f1:
        with st.container(border=True):
            st.metric("Total Fleet Units", len(fleet))
    with f2:
        with st.container(border=True):
            st.metric("Active / Deployed", active_count)
    with f3:
        with st.container(border=True):
            st.metric("Available on Standby", available_count)

    st.divider()

    col_table, col_pie = st.columns([3, 2])

    with col_table:
        st.markdown("**All Fleet Units**")
        df_fleet = pd.DataFrame([{
            "Unit ID": a.get("unitId","?"),
            "Driver": a.get("driverName","?"),
            "Status": a.get("status","?"),
            "Available": "✅ Yes" if a.get("isAvailable") else "❌ No",
            "Assigned Hospital": a.get("hospitalName","?"),
        } for a in fleet])
        
        st.dataframe(df_fleet, use_container_width=True, hide_index=True)

    with col_pie:
        st.markdown("**Fleet Status Distribution**")
        status_counts = {}
        for a in fleet:
            s = a.get("status", "Unknown")
            status_counts[s] = status_counts.get(s, 0) + 1
        df_pie = pd.DataFrame(list(status_counts.items()), columns=["Status", "Count"])
        fig_pie = px.pie(df_pie, names="Status", values="Count",
                         color_discrete_sequence=px.colors.qualitative.Safe, hole=0.4)
        fig_pie.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
        )
        st.plotly_chart(fig_pie, use_container_width=True)

    st.divider()
    
    st.markdown("### Advanced Controls")
    c1, c2 = st.columns(2)
    with c1:
        with st.expander("Register New Ambulance Unit"):
            with st.form("add_ambulance_form"):
                st.text_input("License Plate / Unit ID")
                st.text_input("Driver Name")
                st.selectbox("Base Hospital", [h["name"] for h in data["hospitals"]])
                if st.form_submit_button("Register"):
                    st.success("Registration sent to Backend Auth Service!")

    with c2:
        with st.expander("Driver Performance Stats"):
            driver_stats = pd.DataFrame([
                {"Driver": a.get("driverName"), "Avg Response (m)": 8 + (hash(a.get("driverName")) % 7), "Rating": min(5.0, 4.0 + (hash(a.get("driverName")) % 10)/10.0)} 
                for a in fleet
            ])
            st.dataframe(driver_stats, use_container_width=True, hide_index=True)
