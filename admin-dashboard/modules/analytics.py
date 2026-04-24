import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
from datetime import datetime, timedelta

def render_analytics(data):
    st.subheader("Analytics & ML Insights")

    # Use rng seed for consistency in visualizations
    rng = np.random.default_rng(42)

    t1, t2 = st.tabs(["Demand Analytics", "ML Predictive Insights"])

    with t1:
        st.markdown("### Emergency Demand Overview")
        
        col_peak, col_trend = st.columns(2)
        
        with col_peak:
            st.markdown("**Peak Hours Analysis**")
            hours = list(range(24))
            # Simulate realistic peaks: morning and evenings
            heatmap_data = rng.integers(0, 12, size=(7, 24)).astype(float)
            for d in range(5):
                heatmap_data[d, 7:10] += rng.uniform(3, 6, 3)
                heatmap_data[d, 17:20] += rng.uniform(2, 5, 3)
            
            hourly_avg = heatmap_data.mean(axis=0)
            df_peak = pd.DataFrame({"Hour": [f"{h:02d}:00" for h in hours], "Avg Requests": hourly_avg})
            fig_peak = px.bar(df_peak, x="Hour", y="Avg Requests",
                              color="Avg Requests", color_continuous_scale="Oranges")
            fig_peak.update_layout(
                plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                margin=dict(t=10, b=10, l=10, r=10),
                showlegend=False, coloraxis_showscale=False,
            )
            st.plotly_chart(fig_peak, use_container_width=True)

        with col_trend:
            st.markdown("**Response Time Trends (Last 7 Days)**")
            trend_days = [datetime.now().date() - timedelta(days=i) for i in range(6, -1, -1)]
            # Simulate response time dropping slightly over the week
            trend_vals = 15 - np.linspace(0, 2, 7) + rng.normal(0, 1, 7)
            df_trend = pd.DataFrame({"Date": trend_days, "Avg Response Delay (mins)": trend_vals})
            fig_trend = px.line(df_trend, x="Date", y="Avg Response Delay (mins)", markers=True,
                                color_discrete_sequence=["#06d6a0"])
            fig_trend.update_layout(
                plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                margin=dict(t=10, b=10, l=10, r=10),
                yaxis=dict(range=[0, 20])
            )
            st.plotly_chart(fig_trend, use_container_width=True)

        st.markdown("**Weekly Demand Heatmap**")
        days_of_week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        df_heat = pd.DataFrame(heatmap_data, index=days_of_week, columns=hours)
        fig_heat = go.Figure(data=go.Heatmap(
            z=df_heat.values,
            x=[f"{h:02d}:00" for h in hours],
            y=days_of_week,
            colorscale="YlOrRd",
            showscale=True,
        ))
        fig_heat.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
        )
        st.plotly_chart(fig_heat, use_container_width=True)

    with t2:
        st.markdown("### ERIS AI: Predictive Insights")

        c1, c2 = st.columns(2)
        with c1:
            st.info("🧠 **Delay Prediction Engine** is Active.\nCurrent average model confidence: 94.2%")
        with c2:
            st.warning("⚠️ **High Risk Zone Predicted:** Sector 12, Whitefield.\nExpect 15% increase in traffic delays over the next 2 hours.")

        st.divider()

        # Mock Risk Zones output
        st.markdown("**AI Predicted Risk Zones for Next 4 Hours**")
        risk_data = pd.DataFrame([
            {"Zone": "Whitefield", "Predicted Incidents": 12, "Severity": "High", "Traffic Multiplier": "1.4x"},
            {"Zone": "Electronic City", "Predicted Incidents": 8, "Severity": "Medium", "Traffic Multiplier": "1.1x"},
            {"Zone": "Koramangala", "Predicted Incidents": 15, "Severity": "High", "Traffic Multiplier": "1.6x"},
            {"Zone": "Indiranagar", "Predicted Incidents": 5, "Severity": "Low", "Traffic Multiplier": "0.9x"},
        ])
        st.dataframe(risk_data, use_container_width=True, hide_index=True)

        st.divider()
        st.markdown("**24-Hour ML Delay Forecast**")
        now = datetime.now()
        hours_24 = [now + timedelta(hours=i) for i in range(24)]
        t24 = np.arange(24)
        base_24 = 10 + 4 * np.sin((t24 - 6) * np.pi / 12)
        noise_24 = rng.normal(0, 1, 24)
        forecast_24 = np.clip(base_24 + noise_24, 0, None)
        
        fig_forecast = go.Figure([
            go.Scatter(x=hours_24, y=forecast_24, mode="lines+markers",
                       line=dict(color="#8a2be2", width=2), name="Expected Delay (mins)"),
        ])
        fig_forecast.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(t=10, b=10, l=10, r=10),
            xaxis_title="Time", yaxis_title="Minutes",
        )
        st.plotly_chart(fig_forecast, use_container_width=True)
