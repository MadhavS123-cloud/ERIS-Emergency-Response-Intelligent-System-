# Implementation Plan: Enhanced ML Data Exploration

## Overview

This implementation transforms ERIS from a basic ML delay prediction system into a comprehensive ML intelligence platform. The implementation is organized into five major subsystems that build incrementally:

1. **Data Generation Engine** - Creates realistic emergency response datasets
2. **Feature Store** - Centralized feature management with Redis and Parquet storage
3. **Multi-Model ML Service** - Expands ML capabilities beyond delay prediction
4. **Analytics Dashboard** - Advanced visualization and exploration interface
5. **ML Operations Pipeline** - Automated training, monitoring, and explainability

The implementation uses Python throughout, with FastAPI for the ML service, Streamlit for the dashboard, and scikit-learn/XGBoost for ML models.

## Tasks

- [x] 1. Set up ML service infrastructure and dependencies
  - Create `ml_service/` directory structure
  - Set up Python virtual environment with requirements.txt (FastAPI, scikit-learn, XGBoost, pandas, numpy, redis, SHAP, Hypothesis, MLflow, Prophet, Optuna)
  - Configure FastAPI application with CORS, logging, and error handling
  - Set up Redis connection for feature store
  - Create database migration for new ML-related tables (ml_predictions, feature_definitions, demand_forecasts, resource_recommendations, pattern_analysis, data_quality_metrics, model_training_runs)
  - _Requirements: 6.1, 6.6, 7.8, 12.1, 12.2_

- [x] 2. Implement Data Generation Engine
  - [x] 2.1 Create EmergencyRequestGenerator class
    - Implement temporal pattern generation (hourly, daily, weekly seasonality)
    - Implement spatial distribution based on population density
    - Implement correlated feature generation (traffic-time, weather-delay correlations)
    - Implement configurable parameters (date ranges, geographic bounds, volume, distributions)
    - _Requirements: 1.1, 1.2, 1.3, 1.6_
  
  - [ ]* 2.2 Write property test for temporal patterns
    - **Property 1: Data Generation Temporal Patterns**
    - **Validates: Requirements 1.1**
  
  - [ ]* 2.3 Write property test for spatial correlation
    - **Property 2: Data Generation Spatial Correlation**
    - **Validates: Requirements 1.2**
  
  - [ ]* 2.4 Write property test for feature correlations
    - **Property 3: Data Generation Feature Correlations**
    - **Validates: Requirements 1.3**
  
  - [x] 2.5 Create AmbulanceFleetGenerator class
    - Generate ambulance fleet with driver schedules
    - Generate maintenance windows and availability patterns
    - Generate historical performance metrics
    - _Requirements: 1.4_
  
  - [ ]* 2.6 Write property test for constraint satisfaction
    - **Property 4: Data Generation Constraint Satisfaction**
    - **Validates: Requirements 1.4**
  
  - [x] 2.7 Create HospitalCapacityGenerator class
    - Generate time-varying hospital capacity data
    - Implement realistic capacity change patterns
    - Ensure capacity invariants (non-negative, within bounds)
    - _Requirements: 1.5_
  
  - [ ]* 2.8 Write property test for capacity invariants
    - **Property 5: Data Generation Capacity Invariants**
    - **Validates: Requirements 1.5**
  
  - [x] 2.9 Create GroundTruthLabeler class
    - Implement deterministic delay computation based on causal factors
    - Implement risk category classification (Low/Medium/High/Severe)
    - Ensure monotonic relationships (traffic increases delay, distance increases delay)
    - _Requirements: 1.7_
  
  - [ ]* 2.10 Write property test for deterministic delay computation
    - **Property 7: Data Generation Deterministic Delay Computation**
    - **Validates: Requirements 1.7**
  
  - [x] 2.11 Implement dataset export functionality
    - Support CSV, JSON, and Parquet export formats
    - Include metadata in exports (generation parameters, statistics)
    - _Requirements: 1.8, 1.9_
  
  - [ ]* 2.12 Write property test for export format round-trip
    - **Property 8: Data Export Format Round-Trip**
    - **Validates: Requirements 1.8**
  
  - [x] 2.13 Create FastAPI endpoint for dataset generation
    - POST /api/ml/generate-dataset endpoint
    - Request validation with Pydantic models
    - Async generation with progress tracking
    - _Requirements: 1.6, 1.8_

- [x] 3. Checkpoint - Verify data generation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Feature Store
  - [x] 4.1 Create FeatureRegistry class
    - Implement feature registration with metadata
    - Store feature definitions (name, computation function, dependencies, data type)
    - _Requirements: 7.9_
  
  - [x] 4.2 Create FeatureStore class with online/offline storage
    - Implement Redis-based online feature serving
    - Implement Parquet-based offline feature storage
    - Implement feature versioning with timestamps
    - _Requirements: 7.7, 7.8_
  
  - [x] 4.3 Implement temporal feature computation
    - Extract hour_of_day, day_of_week, month, is_weekend, is_holiday
    - Compute time_since_last_request, requests_last_hour, requests_last_24h
    - _Requirements: 7.1_
  
  - [x] 4.4 Implement geographic feature computation
    - Compute distance_to_nearest_hospital, area_type, population_density
    - Compute historical_request_density_area, avg_response_time_area
    - _Requirements: 7.2_
  
  - [x] 4.5 Implement contextual feature computation
    - Extract traffic_level, weather, temperature, visibility
    - Compute available_ambulances_nearby, hospital_capacity_pct
    - _Requirements: 7.3_
  
  - [x] 4.6 Implement historical aggregation features
    - Compute avg_delay_last_7days_area, avg_delay_last_30days_area
    - Compute hospital_utilization_rate_24h, ambulance_utilization_rate_24h
    - _Requirements: 7.4_
  
  - [x] 4.7 Implement derived feature computation
    - Compute traffic_adjusted_distance, weather_adjusted_delay
    - Compute capacity_weighted_hospital_score
    - _Requirements: 7.5_
  
  - [ ]* 4.8 Write property test for feature computation determinism
    - **Property 20: Feature Computation Determinism and Correctness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
  
  - [x] 4.9 Implement incremental feature updates
    - Update features without full recomputation
    - Maintain feature freshness
    - _Requirements: 7.6_
  
  - [ ]* 4.10 Write property test for incremental update equivalence
    - **Property 21: Feature Store Incremental Update Equivalence**
    - **Validates: Requirements 7.6**
  
  - [x] 4.11 Create FastAPI endpoints for feature serving
    - POST /api/features/compute endpoint
    - GET /api/features/batch endpoint
    - Implement <100ms latency for online serving
    - _Requirements: 7.8_

- [x] 5. Checkpoint - Verify feature store
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Multi-Model ML Service
  - [x] 6.1 Enhance existing delay predictor model
    - Retrain with expanded feature set (25+ features)
    - Implement prediction intervals
    - Update model to return risk categories
    - _Requirements: 6.1, 6.6_
  
  - [x] 6.2 Implement Severity Classifier
    - Create Random Forest classifier for severity levels (Critical/High/Medium/Low)
    - Train on emergency type, patient vitals, location, time features
    - Implement confidence scoring
    - _Requirements: 6.1, 6.6_
  
  - [x] 6.3 Implement Hospital Recommender
    - Create multi-criteria scoring model
    - Score hospitals based on distance, capacity, specialization, patient needs
    - Return ranked list with explanations
    - _Requirements: 6.2, 6.6_
  
  - [x] 6.4 Implement Demand Forecaster
    - Create Prophet time series model for demand forecasting
    - Implement hourly forecasts for next 24 hours
    - Implement daily forecasts for next 7 days
    - Segment forecasts by emergency type and region
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_
  
  - [x] 6.5 Implement Resource Allocator
    - Create optimization model for ambulance positioning
    - Predict optimal ambulance locations to minimize response times
    - Recommend ambulance redeployment based on predicted demand
    - Predict hospital capacity utilization for next 6 hours
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 6.6 Implement Pattern Analyzer
    - Create Isolation Forest for anomaly detection
    - Implement temporal pattern recognition (peak hours, seasonal trends)
    - Implement geographic cluster detection
    - Implement performance anomaly detection
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_
  
  - [ ]* 6.7 Write property test for prediction output structure
    - **Property 18: ML Service Prediction Output Structure**
    - **Validates: Requirements 6.6**
  
  - [x] 6.8 Create FastAPI endpoints for all prediction types
    - POST /api/ml/predict/delay
    - POST /api/ml/predict/severity
    - POST /api/ml/recommend/hospital
    - GET /api/ml/forecast/demand
    - POST /api/ml/allocate/resources
    - POST /api/ml/analyze/patterns
    - POST /api/ml/predict/batch
    - _Requirements: 6.1, 6.2, 3.1, 4.1, 5.1, 6.7_
  
  - [ ]* 6.9 Write property test for batch-individual equivalence
    - **Property 19: ML Service Batch-Individual Equivalence**
    - **Validates: Requirements 6.7, 12.5**
  
  - [x] 6.10 Implement model caching for performance
    - Cache loaded models with TTL
    - Implement feature caching to avoid redundant computation
    - _Requirements: 12.3, 12.4_
  
  - [ ]* 6.11 Write property test for caching equivalence
    - **Property 33: ML Service Caching Equivalence**
    - **Validates: Requirements 12.3, 12.4**
  
  - [x] 6.12 Implement graceful degradation
    - Return cached predictions when models unavailable
    - Return default predictions based on historical averages
    - Include fallback indicators in responses
    - _Requirements: 12.8_
  
  - [ ]* 6.13 Write property test for graceful degradation validity
    - **Property 34: ML Service Graceful Degradation Validity**
    - **Validates: Requirements 12.8**
  
  - [x] 6.14 Implement prediction logging
    - Log all predictions with timestamps, inputs, outputs
    - Store in ml_predictions table
    - Track latency metrics
    - _Requirements: 6.8, 12.7, 12.9_

- [x] 7. Checkpoint - Verify ML service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Explainability Engine
  - [x] 8.1 Create ExplainabilityEngine class
    - Initialize SHAP explainers for each model type
    - Load natural language generation templates
    - _Requirements: 9.1, 9.7_
  
  - [x] 8.2 Implement SHAP value computation
    - Compute SHAP values for feature importance
    - Ensure values sum correctly (SHAP property)
    - Identify top N contributing factors
    - _Requirements: 9.1, 9.5, 9.6_
  
  - [ ]* 8.3 Write property test for feature importance validity
    - **Property 27: Explanation Feature Importance Validity**
    - **Validates: Requirements 9.1, 9.5, 9.6**
  
  - [x] 8.4 Implement natural language explanation generation
    - Create templates for each prediction type
    - Generate human-readable explanations from SHAP values
    - Include impact magnitudes and directions
    - _Requirements: 9.2_
  
  - [x] 8.5 Implement counterfactual explanation generation
    - Generate "what if" scenarios
    - Compute predicted outcomes for counterfactuals
    - Assess feasibility of counterfactual scenarios
    - _Requirements: 9.3_
  
  - [x] 8.6 Implement confidence explanation generation
    - Explain why confidence level is high/medium/low
    - Reference similar historical cases
    - Include model accuracy on similar cases
    - _Requirements: 9.1_
  
  - [ ]* 8.7 Write property test for explanation completeness
    - **Property 28: Explanation Completeness**
    - **Validates: Requirements 4.9, 6.9, 9.2, 9.3, 9.9**
  
  - [x] 8.8 Integrate explainability with all ML endpoints
    - Add explanation field to all prediction responses
    - Include top 3 factors with impact magnitudes
    - Ensure model-agnostic compatibility
    - _Requirements: 4.9, 6.9, 9.6, 9.7_

- [x] 9. Implement Training Pipeline
  - [x] 9.1 Create TrainingPipeline class
    - Initialize MLflow client for experiment tracking
    - Connect to Feature Store for training data
    - _Requirements: 8.9_
  
  - [x] 9.2 Implement training data extraction
    - Extract historical data from PostgreSQL
    - Compute features via Feature Store
    - Handle large datasets efficiently
    - _Requirements: 8.1_
  
  - [x] 9.3 Implement temporal data splitting
    - Split data with temporal ordering (no data leakage)
    - Implement 70/15/15 train/validation/test split
    - _Requirements: 8.2_
  
  - [ ]* 9.4 Write property test for temporal ordering
    - **Property 23: Training Data Split Temporal Ordering**
    - **Validates: Requirements 8.2**
  
  - [x] 9.5 Implement hyperparameter tuning with Optuna
    - Define search spaces for each model type
    - Optimize on validation set
    - Track tuning experiments in MLflow
    - _Requirements: 8.3_
  
  - [x] 9.6 Implement model evaluation
    - Compute regression metrics (MAE, RMSE, R², MAPE)
    - Compute classification metrics (accuracy, precision, recall, F1, AUC-ROC)
    - Compute forecasting metrics (MAE, RMSE, coverage, directional accuracy)
    - Generate evaluation reports
    - _Requirements: 8.4, 8.7_
  
  - [ ]* 9.7 Write property test for evaluation metrics correctness
    - **Property 24: Model Evaluation Metrics Correctness**
    - **Validates: Requirements 8.4**
  
  - [x] 9.8 Implement model comparison and promotion logic
    - Compare new model metrics with production model
    - Promote if new model outperforms on all critical metrics
    - Store model artifacts in MLflow registry
    - _Requirements: 8.5, 8.6_
  
  - [ ]* 9.9 Write property test for promotion logic correctness
    - **Property 25: Model Promotion Logic Correctness**
    - **Validates: Requirements 8.5, 8.6**
  
  - [x] 9.10 Implement model versioning and rollback
    - Store model versions with metadata
    - Implement rollback to previous versions
    - _Requirements: 8.8_
  
  - [ ]* 9.11 Write property test for rollback integrity
    - **Property 26: Model Versioning Rollback Integrity**
    - **Validates: Requirements 8.8**
  
  - [x] 9.12 Create training pipeline CLI and scheduler
    - Create CLI for manual training runs
    - Set up weekly scheduled training (cron jobs)
    - Implement retry logic with exponential backoff
    - _Requirements: 8.1_
  
  - [x] 9.13 Store training metadata in database
    - Store training runs in model_training_runs table
    - Track hyperparameters, metrics, status, promotion history
    - _Requirements: 8.9_

- [x] 10. Checkpoint - Verify training pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Data Quality Monitoring
  - [x] 11.1 Create DataQualityMonitor class
    - Monitor data completeness (missing values, null fields)
    - Detect data distribution shifts (feature drift, target drift)
    - Validate data consistency (referential integrity, value ranges)
    - Detect outliers and anomalous values
    - Monitor data freshness
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ]* 11.2 Write property test for quality metric detection
    - **Property 11: Data Quality Metric Detection**
    - **Validates: Requirements 2.8, 10.1, 10.2, 10.3, 10.4**
  
  - [x] 11.3 Implement quality alert generation
    - Generate alerts with severity levels (low/medium/high/critical)
    - Include affected metrics and recommended actions
    - _Requirements: 10.6_
  
  - [ ]* 11.4 Write property test for alert generation
    - **Property 30: Data Quality Alert Generation**
    - **Validates: Requirements 10.6**
  
  - [x] 11.5 Store quality metrics in database
    - Store metrics in data_quality_metrics table
    - Maintain historical trends
    - _Requirements: 10.8, 10.9_
  
  - [ ]* 11.6 Write property test for trend storage integrity
    - **Property 31: Data Quality Trend Storage Integrity**
    - **Validates: Requirements 10.9**

- [x] 12. Implement Analytics Dashboard enhancements
  - [x] 12.1 Create Data Explorer page
    - Interactive time-series visualizations with drill-down (Plotly)
    - Geographic heatmaps with filters (Plotly + Folium)
    - Correlation matrices (Seaborn/Plotly)
    - Distribution plots with statistical summaries
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 12.2 Implement interactive filtering controls
    - Date range selectors
    - Emergency type multi-select
    - Hospital multi-select
    - Risk level sliders
    - Reactive visualization updates
    - _Requirements: 2.5, 2.9_
  
  - [x] 12.3 Implement data export functionality
    - Export filtered datasets to CSV
    - Export visualizations to PNG/PDF
    - _Requirements: 2.7_
  
  - [ ]* 12.4 Write property test for export filter preservation
    - **Property 10: Data Export Filter Preservation**
    - **Validates: Requirements 2.7**
  
  - [x] 12.5 Create ML Model Performance page
    - Accuracy trends over time
    - Prediction distribution analysis
    - Error analysis (residual plots, confusion matrices)
    - Feature importance visualizations
    - Model comparison views
    - _Requirements: 2.6, 11.5_
  
  - [x] 12.6 Create Demand Forecasting page
    - 24-hour and 7-day forecast visualizations
    - Actual vs predicted comparisons
    - Forecast accuracy metrics
    - Regional demand heatmaps
    - _Requirements: 3.7_
  
  - [x] 12.7 Create Resource Allocation page
    - Current fleet positioning map
    - Recommended repositioning visualizations
    - Expected impact metrics display
    - Historical allocation effectiveness
    - _Requirements: 4.7, 4.8_
  
  - [x] 12.8 Create Pattern Analysis page
    - Detected anomalies timeline
    - Pattern discovery visualizations
    - Alert management interface
    - Investigation tools
    - _Requirements: 5.6, 5.7, 5.9_
  
  - [x] 12.9 Create Data Quality Dashboard page
    - Data quality metrics display
    - Quality trends over time
    - Issue summaries and alerts
    - _Requirements: 10.7_
  
  - [x] 12.10 Create Reports page
    - Executive summary dashboard with KPIs
    - Performance trend charts
    - Drill-down capabilities
    - Automated report generation (weekly/monthly)
    - Export to PDF/Excel
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 11.7, 11.8_
  
  - [ ]* 12.11 Write property test for report generation completeness
    - **Property 32: Report Generation Completeness**
    - **Validates: Requirements 11.1, 11.4, 11.8, 11.9**
  
  - [x] 12.12 Implement auto-refresh for real-time updates
    - Set up 30-second auto-refresh for live data
    - Add manual refresh controls
    - _Requirements: 2.9_

- [x] 13. Integrate ML service with Backend API
  - [x] 13.1 Update Backend API to call ML service for predictions
    - Modify request creation flow to fetch features from Feature Store
    - Call ML service for delay, severity, and hospital recommendations
    - Store predictions in ml_predictions table
    - _Requirements: 6.1, 6.2, 12.1, 12.2_
  
  - [x] 13.2 Add endpoints for demand forecasts
    - GET /api/forecasts/demand endpoint
    - Return forecasts from ML service
    - _Requirements: 3.7, 3.8_
  
  - [x] 13.3 Add endpoints for resource allocation recommendations
    - GET /api/resources/recommendations endpoint
    - Return recommendations from ML service
    - Track recommendation execution and outcomes
    - _Requirements: 4.7, 4.8_
  
  - [x] 13.4 Add endpoints for pattern analysis
    - GET /api/patterns/anomalies endpoint
    - GET /api/patterns/trends endpoint
    - Return analysis results from ML service
    - _Requirements: 5.6, 5.7_
  
  - [x] 13.5 Implement error handling and fallback logic
    - Handle ML service unavailability gracefully
    - Return cached or default predictions on failure
    - Log errors for monitoring
    - _Requirements: 12.8_

- [x] 14. Implement performance optimizations
  - [x] 14.1 Optimize ML service latency
    - Implement model caching with TTL
    - Implement feature caching
    - Optimize feature computation
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [x] 14.2 Implement request queuing with priority handling
    - Queue requests during high load
    - Prioritize critical requests
    - _Requirements: 12.6_
  
  - [x] 14.3 Set up latency and throughput monitoring
    - Track p50, p95, p99 latency percentiles
    - Monitor throughput (requests/second)
    - Alert on performance degradation
    - _Requirements: 12.7_
  
  - [ ]* 14.4 Write unit tests for latency requirements
    - Test delay prediction <200ms
    - Test all predictions <500ms
    - Test feature serving <100ms
    - _Requirements: 12.1, 12.2, 7.8_

- [x] 15. Write comprehensive integration tests
  - [ ]* 15.1 Write end-to-end prediction flow integration test
    - Test complete flow: request → features → prediction → storage
    - _Requirements: 6.1, 7.8, 12.1, 12.2_
  
  - [ ]* 15.2 Write training pipeline integration test
    - Test complete flow: data extraction → feature computation → training → evaluation → promotion
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [ ]* 15.3 Write analytics dashboard integration test
    - Test data queries, ML service calls, visualization rendering
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [ ]* 15.4 Write data generation to training integration test
    - Test synthetic data generation → storage → training → inference
    - _Requirements: 1.1, 1.2, 1.3, 8.1, 8.2_

- [x] 16. Set up monitoring and alerting
  - [x] 16.1 Configure ML service monitoring
    - Monitor error rate (alert if >5%)
    - Monitor latency percentiles (alert if p95 >1000ms)
    - Monitor prediction volume
    - _Requirements: 12.7_
  
  - [x] 16.2 Configure Feature Store monitoring
    - Monitor cache hit rate (alert if <80%)
    - Monitor Redis availability
    - Monitor feature computation latency
    - _Requirements: 7.8_
  
  - [x] 16.3 Configure training pipeline monitoring
    - Monitor training success rate (alert on any failure)
    - Monitor training duration
    - Monitor model performance metrics
    - _Requirements: 8.1, 8.4_
  
  - [x] 16.4 Configure data quality monitoring
    - Monitor quality check failures (alert on critical issues)
    - Monitor data freshness
    - Monitor distribution shifts
    - _Requirements: 10.6, 10.7, 10.8_
  
  - [x] 16.5 Set up alert channels
    - Configure PagerDuty for critical alerts
    - Configure Slack for high/medium alerts
    - Configure email for low alerts
    - _Requirements: 5.6, 10.6_

- [x] 17. Documentation and deployment
  - [x] 17.1 Write API documentation
    - Document all ML service endpoints with examples
    - Document Feature Store API
    - Document Backend API changes
    - _Requirements: All_
  
  - [x] 17.2 Write deployment guide
    - Document infrastructure requirements
    - Document environment variables and configuration
    - Document database migrations
    - Document Redis setup
    - Document MLflow setup
    - _Requirements: All_
  
  - [x] 17.3 Write user guide for Analytics Dashboard
    - Document all dashboard pages and features
    - Provide usage examples and screenshots
    - Document export and reporting features
    - _Requirements: 2.1-2.9, 11.1-11.9_
  
  - [x] 17.4 Write ML operations guide
    - Document training pipeline usage
    - Document model promotion process
    - Document monitoring and alerting
    - Document troubleshooting procedures
    - _Requirements: 8.1-8.9_

- [x] 18. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties (36 properties total)
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions
- The implementation uses Python throughout (FastAPI, Streamlit, scikit-learn, XGBoost, Prophet, SHAP, Hypothesis, MLflow, Optuna)
- Redis is used for online feature serving, Parquet for offline storage
- MLflow is used for model registry and experiment tracking
- All ML predictions include explainability via SHAP values and natural language generation
