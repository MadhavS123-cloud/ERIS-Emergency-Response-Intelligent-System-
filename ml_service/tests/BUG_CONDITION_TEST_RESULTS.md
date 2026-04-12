# Bug Condition Exploration Test Results

## Test Execution Date
2024-01-15

## Test Status: FAILED (Expected - Bug Confirmed)

### Test 1: ML Hospital Recommendation Returns Hardcoded Fake Hospitals
**Status:** ✅ FAILED (Bug Detected - This is correct!)

**Bug Detected:**
```
BUG DETECTED: ML endpoint returns hardcoded fake hospitals.
Found: ['City General Hospital', 'Memorial Medical Center'] 
with IDs ['hosp-1', 'hosp-2']. 
Expected: Real hospital records from database.
```

**Root Cause Confirmed:**
The `recommend_hospital` function in `ml_service/routers/predictions.py` returns hardcoded hospital data instead of querying the PostgreSQL database.

**Counterexample:**
- Input: Patient location (40.7580, -73.9855), emergency type "cardiac_arrest"
- Output: Hardcoded hospitals "City General Hospital" and "Memorial Medical Center"
- Expected: Real hospitals from database with actual IDs, names, and coordinates

### Test 2: Phone Number Storage
**Status:** Requires backend database access (Skipped in initial run)

**Expected Bug:** Empty phone numbers stored as "Not Provided" string instead of null

### Test 3: ML Predictions Use Hardcoded NY Coordinates
**Status:** Requires feature computation inspection (Skipped in initial run)

**Expected Bug:** ML predictions use hardcoded New York coordinates (40.7128, -74.0060) instead of actual request location

### Test 4: Ambulance Start Location Not From Hospital GPS
**Status:** Requires backend database access (Skipped in initial run)

**Expected Bug:** Ambulance location not initialized from hospital's real GPS coordinates

### Test 5: Ambulance Tracking Missing Full Route
**Status:** Requires backend tracking service inspection (Skipped in initial run)

**Expected Bug:** Tracking only includes ambulance → patient, missing hospital location

### Test 6: Data Retrieval Uses Hardcoded Placeholders
**Status:** Covered by Test 1

## Conclusion

The bug condition exploration test successfully detected the hardcoded data issue in the ML hospital recommendation endpoint. This confirms the bug exists and validates our root cause analysis.

**Next Steps:**
1. ✅ Bug condition test written and run (FAILED as expected)
2. ⏭️ Write preservation property tests
3. ⏭️ Implement fixes for all 6 hardcoded data issues
4. ⏭️ Re-run bug condition test (should PASS after fix)
5. ⏭️ Verify preservation tests still pass
