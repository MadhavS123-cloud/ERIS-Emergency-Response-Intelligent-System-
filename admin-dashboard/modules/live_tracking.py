import streamlit as st
import pandas as pd
import plotly.express as px
from utils.data_loader import BASE_LAT, BASE_LNG

def render_live_tracking(data):
    st.subheader("Live Tracking")

    all_requests = data["requests"]
    fleet = data["fleet"]
    hospitals = data["hospitals"]

    map_rows = []

    # Map interactive lines (simulated ETAs/Routes) using patient and assigned ambulance locations
    # For a real system we would plot Path objects, but scatter_mapbox is tricky for individual path segments at scale without lines mode.
    # We will just show coordinates for now and maybe add lines by interlacing rows.

    for r in all_requests:
        if r.get("status") in ("COMPLETED", "CANCELLED"):
            continue
        lat = r.get("locationLat")
        lng = r.get("locationLng")
        if lat and lng:
            map_rows.append({
                "lat": lat, "lon": lng,
                "label": f"Emergency: {r.get('patientName','?')} ({r.get('emergencyType','?')}) | ETA: {r.get('mlDelayMins', 0)}m",
                "type": "Emergency",
                "color": "red",
                "size": 10,
            })

    for a in fleet:
        map_rows.append({
            "lat": a.get("locationLat", BASE_LAT),
            "lon": a.get("locationLng", BASE_LNG),
            "label": f"Ambulance: {a.get('unitId','?')} — {a.get('status','?')}",
            "type": "Ambulance",
            "color": "deepskyblue" if a.get("isAvailable") else "lime",
            "size": 12,
        })

    for h in hospitals:
        map_rows.append({
            "lat": h.get("locationLat", BASE_LAT),
            "lon": h.get("locationLng", BASE_LNG),
            "label": f"Hospital: {h.get('name','?')}",
            "type": "Hospital",
            "color": "green",
            "size": 14,
        })

    if map_rows:
        df_map = pd.DataFrame(map_rows)
        color_map = {"Emergency": "red", "Ambulance": "deepskyblue", "Hospital": "green"}

        fig_map = px.scatter_mapbox(
            df_map, lat="lat", lon="lon",
            hover_name="label",
            color="type",
            color_discrete_map=color_map,
            size="size",
            size_max=14,
            zoom=11,
            center={"lat": BASE_LAT, "lon": BASE_LNG},
            mapbox_style="carto-darkmatter",
            height=600,
        )
        fig_map.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=0, b=0, l=0, r=0),
            legend_title_text="Legend",
        )
        st.plotly_chart(fig_map, use_container_width=True)
    else:
        st.info("No active locations to display.")

    m1, m2, m3 = st.columns(3)
    m1.metric("Active Emergencies on Map", sum(1 for r in map_rows if r["type"] == "Emergency"))
    m2.metric("Ambulances Linked", sum(1 for r in map_rows if r["type"] == "Ambulance"))
    m3.metric("Hospitals", sum(1 for r in map_rows if r["type"] == "Hospital"))

    if st.button("Refresh Map (Manual)"):
        st.rerun()
