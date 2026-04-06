import pandas as pd
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier, XGBRegressor
from sklearn.metrics import accuracy_score, classification_report, mean_absolute_error, mean_squared_error
import warnings
warnings.filterwarnings('ignore')

def load_data(filepath='data/emergency_dispatch_data.csv'):
    if not os.path.exists(filepath):
        print(f"Dataset not found at {filepath}. Please run generate_dataset.py first.")
        return None
    return pd.read_csv(filepath)

def train_and_save_models():
    # Load dataset
    df = load_data()
    if df is None: return

    print("Data loaded. Sample size:", df.shape)

    # 1. Define Features (X) and Targets (y_class, y_reg)
    X = df.drop(['delay_minutes', 'delay_risk'], axis=1)
    
    # Target 1: Classification (Delay Risk)
    # XGBoost requires target classes to be numeric (0, 1, 2)
    # We will encode them
    risk_mapping = {'No Delay': 0, 'Moderate Delay': 1, 'Severe Delay': 2}
    y_class = df['delay_risk'].map(risk_mapping)
    
    # Target 2: Regression (Delay Minutes)
    y_reg = df['delay_minutes']

    # 2. Preprocessing
    categorical_features = ['traffic_level', 'weather', 'area_type']
    numeric_features = ['distance_km', 'time_of_day', 'day_of_week', 'driver_response_time_mins', 'available_ambulances_nearby']

    numeric_transformer = Pipeline(steps=[
        ('scaler', StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ])

    # 3. Train Test Split
    X_train, X_test, y_class_train, y_class_test, y_reg_train, y_reg_test = train_test_split(
        X, y_class, y_reg, test_size=0.2, random_state=42
    )

    # --- PROBLEM 1: Classification (Delay Risk) ---
    print("\n--- Training Classification Model (XGBoost) ---")
    classifier_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', XGBClassifier(n_estimators=100, learning_rate=0.1, random_state=42, use_label_encoder=False, eval_metric='mlogloss'))
    ])

    classifier_pipeline.fit(X_train, y_class_train)
    y_class_pred = classifier_pipeline.predict(X_test)
    
    print("Classification Accuracy:", accuracy_score(y_class_test, y_class_pred))
    print("Classification Report:\n", classification_report(y_class_test, y_class_pred))

    # Save Classification Model
    os.makedirs('models', exist_ok=True)
    joblib.dump(classifier_pipeline, 'models/delay_classifier.pkl')
    print("Classification model saved to models/delay_classifier.pkl")

    # Save the mapping for the FastAPI server to reverse
    joblib.dump({v: k for k, v in risk_mapping.items()}, 'models/risk_mapping.pkl')

    # --- PROBLEM 2: Regression (Delay Time Prediction) ---
    print("\n--- Training Regression Model (XGBoost) ---")
    
    regressor_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', XGBRegressor(n_estimators=100, learning_rate=0.1, random_state=42))
    ])

    regressor_pipeline.fit(X_train, y_reg_train)
    y_reg_pred = regressor_pipeline.predict(X_test)
    
    print("Regression MAE (Minutes):", mean_absolute_error(y_reg_test, y_reg_pred))
    print("Regression RMSE (Minutes):", np.sqrt(mean_squared_error(y_reg_test, y_reg_pred)))

    # Save Regression Model
    joblib.dump(regressor_pipeline, 'models/delay_regressor.pkl')
    print("Regression model saved to models/delay_regressor.pkl")

    # --- PROBLEM 3: Feature Importance (Root Cause Analysis) ---
    print("\n--- Extracting Feature Importance ---")
    xgb_model = classifier_pipeline.named_steps['classifier']
    
    ohe = classifier_pipeline.named_steps['preprocessor'].named_transformers_['cat'].named_steps['onehot']
    cat_feature_names = ohe.get_feature_names_out(categorical_features)
    all_feature_names = numeric_features + list(cat_feature_names)
    
    importances = xgb_model.feature_importances_
    
    feature_importance_df = pd.DataFrame({
        'Feature': all_feature_names,
        'Importance': importances
    }).sort_values(by='Importance', ascending=False)
    
    print(feature_importance_df.head(10))
    feature_importance_df.to_csv('models/feature_importance.csv', index=False)
    print("Feature importance saved to models/feature_importance.csv")

if __name__ == "__main__":
    train_and_save_models()
