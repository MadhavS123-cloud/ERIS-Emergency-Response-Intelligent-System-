import streamlit as st

def load_css():
    """Apply generic custom CSS for better native styling."""
    st.markdown("""
        <style>
        .block-container {
            padding-top: 2rem;
            padding-bottom: 2rem;
        }
        div[data-testid="metric-container"] {
            background-color: rgba(28, 131, 225, 0.1);
            border: 1px solid rgba(28, 131, 225, 0.1);
            padding: 5% 5% 5% 10%;
            border-radius: 5px;
            color: rgb(30, 103, 119);
            overflow-wrap: break-word;
        }
        div[data-testid="metric-container"] > div {
            width: fit-content;
        }
        div[data-testid="stMetricValue"] {
            font-size: 1.8rem;
        }
        /* Make DataFrame headers visually distinct and modern */
        thead tr th {
            background-color: rgba(28, 131, 225, 0.1) !important;
            color: white !important;
            font-weight: 600 !important;
        }
        </style>
    """, unsafe_allow_html=True)
