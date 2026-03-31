import pandas as pd
import numpy as np
import random
import os

def generate_emergency_data(num_samples=5000):
    np.random.seed(42)
    random.seed(42)

    # Features
    traffic_levels = ['Low', 'Medium', 'High']
    weather_conditions = ['Clear', 'Rain', 'Fog', 'Snow']
    area_types = ['Urban', 'Suburban', 'Rural']

    data = {
        'distance_km': np.random.uniform(1.0, 30.0, num_samples).round(2),
        'time_of_day': np.random.randint(0, 24, num_samples),
        'day_of_week': np.random.randint(0, 7, num_samples), # 0=Monday, 6=Sunday
        'traffic_level': np.random.choice(traffic_levels, num_samples, p=[0.4, 0.4, 0.2]),
        'weather': np.random.choice(weather_conditions, num_samples, p=[0.6, 0.2, 0.1, 0.1]),
        'area_type': np.random.choice(area_types, num_samples, p=[0.5, 0.3, 0.2]),
        'driver_response_time_mins': np.random.uniform(0.5, 5.0, num_samples).round(1),
        'available_ambulances_nearby': np.random.randint(0, 5, num_samples)
    }

    df = pd.DataFrame(data)

    # Base travel time: ~2 minutes per km on average, but varies.
    base_time = df['distance_km'] * 2.0 
    
    # Modifiers
    traffic_multiplier = df['traffic_level'].map({'Low': 1.0, 'Medium': 1.5, 'High': 2.5})
    weather_multiplier = df['weather'].map({'Clear': 1.0, 'Rain': 1.3, 'Fog': 1.5, 'Snow': 1.8})
    area_multiplier = df['area_type'].map({'Urban': 1.2, 'Suburban': 1.0, 'Rural': 0.8}) # Rural might be faster but longer distance
    
    # Rush hour penalties
    is_rush_hour = ((df['time_of_day'] >= 7) & (df['time_of_day'] <= 9)) | ((df['time_of_day'] >= 17) & (df['time_of_day'] <= 19))
    rush_hour_multiplier = np.where(is_rush_hour, 1.4, 1.0)
    
    # Scarcity penalty
    scarcity_multiplier = np.where(df['available_ambulances_nearby'] == 0, 1.5, 1.0)

    # Calculate ideal time (no delay)
    ideal_time = base_time + df['driver_response_time_mins']
    
    # Calculate actual time
    actual_time = (base_time * traffic_multiplier * weather_multiplier * area_multiplier * rush_hour_multiplier * scarcity_multiplier) + df['driver_response_time_mins']
    
    # Add some random noise
    actual_time += np.random.normal(0, 2.0, num_samples)
    actual_time = np.maximum(actual_time, ideal_time) # Actual time shouldn't be less than ideal time mostly

    # Calculate delay
    delay_minutes = (actual_time - ideal_time).round(1)
    df['delay_minutes'] = delay_minutes

    # Classify Delay Risk
    # No Delay: < 3 mins
    # Moderate Delay: 3 - 10 mins
    # Severe Delay: > 10 mins
    def categorize_delay(delay):
        if delay < 3.0:
            return 'No Delay'
        elif delay <= 10.0:
            return 'Moderate Delay'
        else:
            return 'Severe Delay'

    df['delay_risk'] = df['delay_minutes'].apply(categorize_delay)

    # Save to CSV
    os.makedirs('data', exist_ok=True)
    df.to_csv('data/emergency_dispatch_data.csv', index=False)
    print(f"Dataset with {num_samples} records generated successfully at data/emergency_dispatch_data.csv!")
    print(df.head())

if __name__ == "__main__":
    generate_emergency_data()
