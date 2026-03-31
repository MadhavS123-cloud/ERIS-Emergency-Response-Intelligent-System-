import joblib
import pandas as pd
import numpy as np
import os
import json

def explain_prediction(prediction_row, feature_importance_df, delay_risk_class, delay_minutes):
    """
    Root Cause Analysis (Problem 3) 
    & Smart Recommendation System (Problem 4)
    """
    reasons = []
    actions = []

    # Simple rule-based logic derived from feature importance to explain the model's decision
    # (In a real scenario, you could use SHAP, but feature importance + rules works well for MVP)

    if prediction_row['traffic_level'].values[0] == 'High':
        reasons.append("High traffic congestion detected on the route.")
        actions.append("Consider taking an alternate route or requesting police escort.")

    if prediction_row['weather'].values[0] in ['Snow', 'Fog']:
        reasons.append(f"Adverse weather conditions ({prediction_row['weather'].values[0]}).")
        actions.append("Alert driver to exercise caution; expect slower speeds.")

    if prediction_row['available_ambulances_nearby'].values[0] == 0:
        reasons.append("No ambulances available in the immediate vicinity.")
        actions.append("Reassigning the next closest available unit from a neighboring zone.")

    if prediction_row['distance_km'].values[0] > 15:
        reasons.append(f"Long distance to location ({prediction_row['distance_km'].values[0]} km).")
        actions.append("Check if a closer hospital or different zone has units.")

    # Fallback main cause
    main_cause = reasons[0] if reasons else "Normal operations"
    
    # Decide final action based on risk
    final_action = "Proceed normally"
    if delay_risk_class == 'Severe Delay':
        if actions:
            final_action = actions[0]
        else:
            final_action = "Escalate to admin for manual review."
    elif delay_risk_class == 'Moderate Delay':
        final_action = "Monitor closely; inform hospital of slight delay."
    
    return {
        "delay_risk": delay_risk_class,
        "expected_delay_minutes": float(round(delay_minutes, 1)),
        "main_cause": main_cause,
        "suggested_action": final_action,
        "all_reasons": reasons
    }

def run_inference():
    if not os.path.exists('models/delay_classifier.pkl') or not os.path.exists('models/delay_regressor.pkl'):
        print("Models not found. Please train models first.")
        return

    classifier = joblib.load('models/delay_classifier.pkl')
    regressor = joblib.load('models/delay_regressor.pkl')
    
    try:
        feature_importance_df = pd.read_csv('models/feature_importance.csv')
    except:
        feature_importance_df = None

    # Simulate an incoming emergency payload from backend
    incoming_data = pd.DataFrame([{
        'distance_km': 18.5,
        'time_of_day': 18, # Rush hour
        'day_of_week': 4,  # Friday
        'traffic_level': 'High',
        'weather': 'Rain',
        'area_type': 'Urban',
        'driver_response_time_mins': 2.0,
        'available_ambulances_nearby': 0
    }])

    # 1. Predict Delay Risk
    delay_risk_pred = classifier.predict(incoming_data)[0]

    # 2. Predict Delay Time
    delay_time_pred = regressor.predict(incoming_data)[0]

    # 3 & 4. Root Cause Analysis & Recommendation
    result = explain_prediction(incoming_data, feature_importance_df, delay_risk_pred, delay_time_pred)
    
    print("\n--- INFERENCE RESULT (READY FOR DASHBOARD) ---")
    print(json.dumps(result, indent=4))

if __name__ == "__main__":
    run_inference()
