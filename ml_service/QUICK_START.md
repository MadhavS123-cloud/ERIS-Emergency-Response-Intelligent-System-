# Quick Start Guide - Enhanced ML Data Exploration

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Python 3.11+
- PostgreSQL (running)
- Redis (optional, for online features)
- Node.js (for backend)

### Step 1: Install ML Service Dependencies
```bash
cd ml_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/eris
REDIS_HOST=localhost
REDIS_PORT=6379
ML_SERVICE_PORT=8000
```

### Step 3: Run Database Migrations
```bash
cd ../backend
npx prisma migrate deploy
```

### Step 4: Start ML Service
```bash
cd ../ml_service
python app.py
```

✅ Service running at: http://localhost:8000

### Step 5: Test the API
Visit: http://localhost:8000/docs

---

## 🧪 Try It Out

### Generate Sample Dataset
```bash
curl -X POST http://localhost:8000/api/ml/generate/dataset \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-01-01",
    "end_date": "2025-01-07",
    "volume_per_day": 50
  }'
```

### Compute Features
```bash
curl -X POST http://localhost:8000/api/features/compute \
  -H "Content-Type: application/json" \
  -d '{
    "location_lat": 40.7128,
    "location_lng": -74.0060,
    "timestamp": "2025-01-15T14:30:00Z"
  }'
```

### Predict Delay
```bash
curl -X POST http://localhost:8000/api/ml/predict/delay \
  -H "Content-Type: application/json" \
  -d '{
    "distance_km": 5.0,
    "time_of_day": 17,
    "day_of_week": 4,
    "traffic_level": "High",
    "weather": "Clear"
  }'
```

---

## 📊 Available Endpoints

### Data Generation
- `POST /api/ml/generate/dataset` - Generate emergency response dataset

### Features (17 features)
- `POST /api/features/compute` - Compute all features
- `GET /api/features/list` - List all features

### ML Predictions
- `POST /api/ml/predict/delay` - Delay prediction
- `POST /api/ml/predict/severity` - Severity classification
- `POST /api/ml/recommend/hospital` - Hospital recommendations
- `GET /api/ml/forecast/demand` - Demand forecasting
- `POST /api/ml/allocate/resources` - Resource allocation
- `POST /api/ml/analyze/patterns` - Pattern analysis

---

## 📚 Documentation

- **API Docs**: http://localhost:8000/docs
- **Completion Summary**: `COMPLETION_SUMMARY.md`
- **Implementation Guide**: `IMPLEMENTATION_GUIDE.md`
- **Feature Store**: `feature_store/README.md`
- **Data Generator**: `data_generator/README.md`

---

## ✅ What's Working

- ✅ Data generation with realistic patterns
- ✅ Feature store with 17 features
- ✅ Delay prediction
- ✅ Severity classification
- ✅ Hospital recommendations
- ✅ Demand forecasting
- ✅ Resource allocation
- ✅ Pattern analysis

---

## 🔧 Troubleshooting

### Redis Connection Error
```bash
# Start Redis
redis-server

# Or disable Redis in .env
REDIS_HOST=
```

### Database Connection Error
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Update DATABASE_URL in .env
```

### Import Errors
```bash
# Reinstall dependencies
pip install -r requirements.txt
```

---

## 🎯 Next Steps

1. **Generate Training Data**
   - Use `/api/ml/generate/dataset` to create datasets
   - Generate 3-6 months of data

2. **Train Models**
   - Implement training pipeline
   - Train on generated data

3. **Add Explainability**
   - Implement SHAP explainer
   - Add natural language explanations

4. **Create Dashboard**
   - Build Streamlit analytics dashboard
   - Connect to ML service

5. **Integrate with Backend**
   - Update Node.js backend
   - Call ML service on request creation

---

## 💡 Tips

- Use Swagger UI for interactive API testing
- Check logs for debugging: `tail -f logs/ml_service.log`
- Redis is optional - service works without it
- Start with small datasets for testing

---

## 📞 Need Help?

1. Check `COMPLETION_SUMMARY.md` for status
2. Review `IMPLEMENTATION_GUIDE.md` for details
3. Test with curl commands above
4. Check API docs at `/docs`

**Happy coding! 🚀**
