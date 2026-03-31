import pandas as pd
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
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
    y_class = df['delay_risk']
    
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
    # We use the same split for both models to be consistent
    X_train, X_test, y_class_train, y_class_test, y_reg_train, y_reg_test = train_test_split(
        X, y_class, y_reg, test_size=0.2, random_state=42
    )

    # --- PROBLEM 1: Classification (Delay Risk) ---
    print("\n--- Training Classification Model (Random Forest) ---")
    classifier_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced'))
    ])

    classifier_pipeline.fit(X_train, y_class_train)
    y_class_pred = classifier_pipeline.predict(X_test)
    
    print("Classification Accuracy:", accuracy_score(y_class_test, y_class_pred))
    print("Classification Report:\n", classification_report(y_class_test, y_class_pred))

    # Save Classification Model
    os.makedirs('models', exist_ok=True)
    joblib.dump(classifier_pipeline, 'models/delay_classifier.pkl')
    print("Classification model saved to models/delay_classifier.pkl")


    # --- PROBLEM 2: Regression (Delay Time Prediction) ---
    print("\n--- Training Regression Model (Random Forest) ---")
    
    # Using RandomForestRegressor for regression
    regressor_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', RandomForestRegressor(n_estimators=100, random_state=42))
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
    # For tree based models, we can extract feature importances
    # Let's extract from the Random Forest Classifier
    rf_model = classifier_pipeline.named_steps['classifier']
    
    # Get feature names from preprocessor
    ohe = classifier_pipeline.named_steps['preprocessor'].named_transformers_['cat'].named_steps['onehot']
    cat_feature_names = ohe.get_feature_names_out(categorical_features)
    all_feature_names = numeric_features + list(cat_feature_names)
    
    importances = rf_model.feature_importances_
    
    # Create a DataFrame for visualization
    feature_importance_df = pd.DataFrame({
        'Feature': all_feature_names,
        'Importance': importances
    }).sort_values(by='Importance', ascending=False)
    
    print(feature_importance_df.head(10))
    feature_importance_df.to_csv('models/feature_importance.csv', index=False)
    print("Feature importance saved to models/feature_importance.csv")

if __name__ == "__main__":
    train_and_save_models()
