from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import uvicorn
import os

app = FastAPI(title="ERIS ML Service", description="Predicts ambulance delay risk and expected time.")

# Load models on startup
try:
    classifier = joblib.load('models/delay_classifier.pkl')
    regressor = joblib.load('models/delay_regressor.pkl')
    risk_mapping = joblib.load('models/risk_mapping.pkl')
    
    try:
        feature_importance_df = pd.read_csv('models/feature_importance.csv')
    except:
        feature_importance_df = None
except Exception as e:
    print(f"Warning: Models not loaded. {e}")

class EmergencyRequest(BaseModel):
    distance_km: float
    time_of_day: int
    day_of_week: int
    traffic_level: str
    weather: str
    area_type: str
    driver_response_time_mins: float
    available_ambulances_nearby: int

class PredictionResponse(BaseModel):
    delay_risk: str
    expected_delay_minutes: float
    main_cause: str
    suggested_action: str
    all_reasons: list[str]

def explain_prediction(prediction_row, delay_risk_class, delay_minutes):
    """
    Root Cause Analysis & Smart Recommendation System based on SHAP/Rules
    """
    reasons = []
    actions = []

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

    main_cause = reasons[0] if reasons else "Normal operations"
    
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

@app.post("/predict", response_model=PredictionResponse)
def predict_delay(request: EmergencyRequest):
    try:
        # Create DataFrame from request
        incoming_data = pd.DataFrame([request.model_dump()])

        # Predict Risk (Classification)
        delay_risk_pred_num = classifier.predict(incoming_data)[0]
        delay_risk_class = risk_mapping.get(delay_risk_pred_num, "Unknown")

        # Predict Delay Time (Regression)
        delay_time_pred = regressor.predict(incoming_data)[0]

        # Generate Explanation
        result = explain_prediction(incoming_data, delay_risk_class, delay_time_pred)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
