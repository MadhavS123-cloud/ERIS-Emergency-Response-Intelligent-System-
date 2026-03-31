# ERIS ML Module

This directory contains the machine learning components for ERIS. This module fulfills the 4 main problems for the final project:

1. **Delay Classification:** Uses Random Forest Classifier to predict if a delay is `No Delay`, `Moderate Delay`, or `Severe Delay`.
2. **Delay Regression:** Uses XGBoost Regressor to predict the exact expected delay in minutes.
3. **Reason/Root Cause Analysis:** Employs feature importance and rule-based logic to figure out why the ambulance will be delayed (e.g., Traffic, Time of day).
4. **Actionable AI (Recommendations):** Suggests actions to the admin based on the predictions.

## Setup Instructions

1. **Create Virtual Environment:**
   ```bash
   cd ml-services
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Generate Dataset:**
   ```bash
   python3 generate_dataset.py
   ```
   This generates a 5000-row simulated dataset (`data/emergency_dispatch_data.csv`) taking into account time of day, weather, traffic, and distance modifiers.

4. **Train Models:**
   ```bash
   python3 train_model.py
   ```
   This will output the models to `models/delay_classifier.pkl` and `models/delay_regressor.pkl`, and save the `feature_importance.csv`.

5. **Test Inference:**
   ```bash
   python3 inference.py
   ```
   This simulates how the Node.js backend would interact with the ML model and outputs a JSON that can be sent to the admin dashboard.

## Next Steps

- Expose `inference.py` logic via a Python HTTP framework like **FastAPI** or **Flask**.
- Update the Node.js backend to make API requests to the Python server.
- Update the Admin Dashboard to read the output and display "Delay Risk", "Expected Delay", "Main Cause", and "Suggested Action".
