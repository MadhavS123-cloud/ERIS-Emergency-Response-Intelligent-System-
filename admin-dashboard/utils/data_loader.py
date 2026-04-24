"""
Centralized Data Loader for ERIS Dashboard
Handles simulated data generation and backend API fetching.
"""
import os
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import streamlit as st

# ── Environment Config ────────────────────────────────────────────────────────
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5001")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8000")
API_BASE = f"{BACKEND_URL}/api/v1"
ML_BASE = f"{ML_SERVICE_URL}"

# ── Seed for reproducible demo data ──────────────────────────────────────────
SEED = 42
rng = np.random.default_rng(SEED)

# Bangalore area coordinates
BASE_LAT, BASE_LNG = 12.9716, 77.5946

HOSPITAL_NAMES = [
    "Apollo Hospitals Whitefield",
    "Vydehi Institute of Medical Sciences",
    "Manipal Hospital Whitefield",
    "Columbia Asia Hospital",
    "Narayana Health City",
    "Fortis Hospital Bannerghatta",
]
EMERGENCY_TYPES = ["Cardiac Arrest", "Trauma/Accident", "Stroke", "Respiratory", "Other"]
DRIVER_NAMES = ["Ravi Kumar", "Suresh Nair", "Anand Sharma", "Priya Menon", "Deepak Rao", "Kavitha Iyer"]
PATIENT_NAMES = ["Arjun Mehta", "Sunita Patel", "Ramesh Gupta", "Lakshmi Devi", "Vikram Singh", "Priya Nair"]

def make_demo_requests(n=18):
    """Generate realistic emergency request records."""
    statuses = ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_TRANSIT", "COMPLETED", "COMPLETED", "COMPLETED"]
    records = []
    for i in range(n):
        created = datetime.now() - timedelta(hours=int(rng.integers(0, 72)))
        etype = rng.choice(EMERGENCY_TYPES)
        status = rng.choice(statuses)
        delay = float(rng.integers(4, 22))
        risk = "High" if delay > 15 else ("Medium" if delay > 9 else "Low")
        records.append({
            "id": f"{rng.integers(0x10000000, 0xFFFFFFFF):08X}",
            "createdAt": created.isoformat(),
            "emergencyType": etype,
            "status": status,
            "patientName": rng.choice(PATIENT_NAMES),
            "patientPhone": f"9{rng.integers(100000000, 999999999)}",
            "pickupAddress": f"Sector {rng.integers(1, 20)}, Whitefield, Bangalore",
            "locationLat": BASE_LAT + rng.uniform(-0.08, 0.08),
            "locationLng": BASE_LNG + rng.uniform(-0.08, 0.08),
            "mlRisk": risk,
            "mlDelayMins": delay,
            "mlReasons": [
                f"{'High' if delay > 15 else 'Moderate'} traffic on route",
                f"Distance: {rng.integers(2, 12)} km",
                f"Time of day: {'Peak' if 7 <= created.hour <= 9 or 17 <= created.hour <= 20 else 'Off-peak'} hours",
            ],
            "mlActions": ["Dispatch nearest available unit", "Alert hospital ER"],
            "ambulancePlate": f"KA-{rng.integers(1,9):02d}-AMB-{rng.integers(100,110)}",
            "driverName": rng.choice(DRIVER_NAMES),
            "hospitalName": rng.choice(HOSPITAL_NAMES),
            "isFake": False,
            "isSuspicious": False,
            "trustScoreAtRequest": int(rng.integers(1, 5)),
        })
    return records

def make_demo_fleet(n=8):
    """Generate realistic ambulance fleet records."""
    fleet = []
    for i in range(n):
        busy = rng.random() > 0.45
        fleet.append({
            "unitId": f"KA-{i+1:02d}-AMB-{100+i}",
            "driverName": DRIVER_NAMES[i % len(DRIVER_NAMES)],
            "status": "Active" if busy else "Available",
            "hospitalName": HOSPITAL_NAMES[i % len(HOSPITAL_NAMES)],
            "locationLat": BASE_LAT + rng.uniform(-0.06, 0.06),
            "locationLng": BASE_LNG + rng.uniform(-0.06, 0.06),
            "isAvailable": not busy,
        })
    return fleet

def make_demo_hospitals():
    """Generate realistic hospital capacity records."""
    hospitals = []
    for i, name in enumerate(HOSPITAL_NAMES):
        hospitals.append({
            "id": f"hosp-{i+1:03d}",
            "name": name,
            "locationLat": BASE_LAT + rng.uniform(-0.07, 0.07),
            "locationLng": BASE_LNG + rng.uniform(-0.07, 0.07),
            "icuBedsAvailable": int(rng.integers(2, 18)),
            "generalBedsAvailable": int(rng.integers(10, 60)),
            "ventilatorsAvailable": int(rng.integers(1, 8)),
            "totalBeds": int(rng.integers(80, 300)),
            "status": "Operational",
        })
    return hospitals

def make_demo_kpis(requests_data, fleet_data):
    active = [r for r in requests_data if r["status"] not in ("COMPLETED", "CANCELLED")]
    deployed = [a for a in fleet_data if a["status"] == "Active"]
    delays = [r["mlDelayMins"] for r in requests_data if r.get("mlDelayMins")]
    return {
        "signals24h": len([r for r in requests_data if
            (datetime.now() - datetime.fromisoformat(r["createdAt"])).total_seconds() < 86400]),
        "unitsDeployed": len(deployed),
        "avgLatencyMins": round(float(np.mean(delays)), 1) if delays else 0,
        "activeNodes": len(HOSPITAL_NAMES),
    }

@st.cache_data(ttl=30)
def load_data():
    """
    Try to fetch live data from the backend.
    Falls back to realistic demo data if the backend is unreachable.
    """
    demo_requests = make_demo_requests(18)
    demo_fleet = make_demo_fleet(8)
    demo_hospitals = make_demo_hospitals()
    demo_kpis = make_demo_kpis(demo_requests, demo_fleet)

    live = False
    requests_data = demo_requests
    fleet_data = demo_fleet
    hospitals_data = demo_hospitals
    kpis_data = demo_kpis

    try:
        r = requests.get(f"{API_BASE}/admin/dashboard-stats", timeout=3)
        if r.status_code == 200:
            d = r.json().get("data", {})
            requests_data = d.get("recentRequests", demo_requests)
            fleet_data = d.get("fleet", demo_fleet)
            kpis_data = d.get("kpis", demo_kpis)
            live = True
    except Exception:
        pass

    try:
        r2 = requests.get(f"{API_BASE}/hospitals", timeout=3)
        if r2.status_code == 200:
            hospitals_data = r2.json().get("data", demo_hospitals)
            live = True
    except Exception:
        pass

    return {
        "requests": requests_data,
        "fleet": fleet_data,
        "hospitals": hospitals_data,
        "kpis": kpis_data,
        "live": live,
    }
