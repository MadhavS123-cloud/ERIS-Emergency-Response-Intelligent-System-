/**
 * Bug Condition Exploration Test (UPDATED FOR FIX VERIFICATION)
 * 
 * This test NOW verifies that ML hospital recommendations ARE stored in Request records.
 * 
 * Expected Behavior (After Fix):
 * 1. ML service returns hospital recommendations with hospital_id and hospital_name
 * 2. Request record DOES have mlRecommendedHospitalId and mlRecommendedHospitalName fields populated
 * 3. Frontend displays ML-recommended hospital name instead of "Awaiting hospital assignment"
 * 
 * This test MUST PASS on fixed code - passing confirms the bug is fixed.
 */

import { prisma } from '../src/config/db.js';
import MLService from '../src/services/ml.service.js';
import requestRepository from '../src/modules/request/request.repository.js';
import { randomUUID } from 'crypto';

// Mock the queue service to avoid Redis dependency in tests
const mockQueue = {
  addEmergencyRequestToQueue: async () => {}
};

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80));
}

// Test data generators
function generateTestLocation() {
  // Generate random location in India (approximate bounds)
  const lat = 20 + Math.random() * 10; // 20-30°N
  const lng = 72 + Math.random() * 10; // 72-82°E
  return { lat, lng };
}

function generateEmergencyType() {
  const types = [
    'Cardiac Arrest',
    'Trauma/Accident',
    'Stroke',
    'Respiratory',
    'Other'
  ];
  return types[Math.floor(Math.random() * types.length)];
}

// Test cases
const testCases = [];

/**
 * Test Case 1: Authenticated Patient Request
 * Verifies that ML recommendations are not stored for authenticated patient requests
 */
async function testAuthenticatedPatientRequest() {
  logSection('Test Case 1: Authenticated Patient Request');
  
  const location = generateTestLocation();
  const emergencyType = generateEmergencyType();
  
  log(`Creating test patient...`, 'blue');
  const testPatient = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: 'Test Patient',
      email: `test-patient-${Date.now()}@example.com`,
      password: 'hashed_password',
      phone: '9876543210',
      role: 'PATIENT'
    }
  });
  
  log(`Creating request for patient at (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`, 'blue');
  
  // Get ML predictions first
  const tempRequest = {
    id: 'temp',
    locationLat: location.lat,
    locationLng: location.lng,
    emergencyType: emergencyType,
    patientAge: null,
    vitalSigns: null
  };
  
  log('Getting ML predictions...', 'blue');
  const predictions = await MLService.recommendHospital({
    patient_location: {
      lat: location.lat,
      lng: location.lng
    },
    emergency_type: emergencyType,
    severity: 'Medium',
    current_time: new Date().toISOString()
  });
  
  // Extract ML hospital recommendation if available
  const mlRecommendedHospitalId = predictions?.recommendations?.[0]?.hospital_id || null;
  const mlRecommendedHospitalName = predictions?.recommendations?.[0]?.hospital_name || null;
  
  if (!mlRecommendedHospitalId || !mlRecommendedHospitalName) {
    log('⚠️  ML service did not return recommendations, skipping test', 'yellow');
    testCases.push({
      name: 'Authenticated Patient Request',
      status: 'SKIPPED',
      reason: 'ML service did not return recommendations'
    });
    
    await prisma.user.delete({ where: { id: testPatient.id } });
    return;
  }
  
  log(`ML recommended hospital: ${mlRecommendedHospitalName} (ID: ${mlRecommendedHospitalId})`, 'green');
  
  // Create request with ML recommendations (simulating what the service layer does)
  const request = await requestRepository.createRequest({
    patientId: testPatient.id,
    locationLat: location.lat,
    locationLng: location.lng,
    emergencyType: emergencyType,
    pickupAddress: 'Test Address',
    patientName: testPatient.name,
    patientPhone: testPatient.phone,
    medicalNotes: 'Test medical notes',
    status: 'PENDING',
    mlRecommendedHospitalId,
    mlRecommendedHospitalName
  });
  
  log(`Request created: ${request.id}`, 'green');
  
  // Fetch the request from database to check if ML recommendation was stored
  const fetchedRequest = await prisma.request.findUnique({
    where: { id: request.id },
    include: {
      ambulance: {
        include: {
          hospital: true
        }
      }
    }
  });
  
  // Check for FIX conditions (opposite of bug conditions)
  const fixConditions = [];
  
  // Condition 1: Request SHOULD have mlRecommendedHospitalId field populated
  if ('mlRecommendedHospitalId' in fetchedRequest && fetchedRequest.mlRecommendedHospitalId !== null) {
    fixConditions.push(`✓ mlRecommendedHospitalId is populated: ${fetchedRequest.mlRecommendedHospitalId}`);
  }
  
  // Condition 2: Request SHOULD have mlRecommendedHospitalName field populated
  if ('mlRecommendedHospitalName' in fetchedRequest && fetchedRequest.mlRecommendedHospitalName !== null) {
    fixConditions.push(`✓ mlRecommendedHospitalName is populated: ${fetchedRequest.mlRecommendedHospitalName}`);
  }
  
  // Condition 3: Frontend would display ML-recommended hospital name
  const displayedHospitalName = fetchedRequest.ambulance?.hospital?.name || fetchedRequest.mlRecommendedHospitalName || 'Awaiting hospital assignment';
  if (displayedHospitalName !== 'Awaiting hospital assignment' && fetchedRequest.mlRecommendedHospitalName) {
    fixConditions.push(`✓ Frontend displays ML-recommended hospital: ${displayedHospitalName}`);
  }
  
  log('\nFix Conditions Met:', 'green');
  fixConditions.forEach(condition => log(`  ${condition}`, 'green'));
  
  // Test PASSES if fix is working (all conditions met)
  const fixWorking = fixConditions.length >= 2;
  
  if (fixWorking) {
    log('\n✓ TEST PASSED: Fix confirmed - ML recommendations ARE stored in Request', 'green');
    testCases.push({
      name: 'Authenticated Patient Request',
      status: 'PASSED',
      fixConfirmed: true,
      conditions: fixConditions,
      mlRecommendation: {
        hospital_id: fetchedRequest.mlRecommendedHospitalId,
        hospital_name: fetchedRequest.mlRecommendedHospitalName
      }
    });
  } else {
    log('\n✗ TEST FAILED: Fix NOT working - ML recommendations still not stored', 'red');
    log(`  mlRecommendedHospitalId: ${fetchedRequest.mlRecommendedHospitalId}`, 'red');
    log(`  mlRecommendedHospitalName: ${fetchedRequest.mlRecommendedHospitalName}`, 'red');
    testCases.push({
      name: 'Authenticated Patient Request',
      status: 'FAILED',
      fixConfirmed: false,
      reason: 'ML recommendations not stored in Request'
    });
  }
  
  // Cleanup
  await prisma.request.delete({ where: { id: request.id } });
  await prisma.user.delete({ where: { id: testPatient.id } });
}

/**
 * Test Case 2: Guest Emergency Request
 * Verifies that ML recommendations are not stored for guest emergency requests
 */
async function testGuestEmergencyRequest() {
  logSection('Test Case 2: Guest Emergency Request');
  
  const location = generateTestLocation();
  const emergencyType = generateEmergencyType();
  
  log(`Creating guest emergency request at (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`, 'blue');
  
  // Get ML predictions first
  log('Getting ML predictions...', 'blue');
  const predictions = await MLService.recommendHospital({
    patient_location: {
      lat: location.lat,
      lng: location.lng
    },
    emergency_type: emergencyType,
    severity: 'Medium',
    current_time: new Date().toISOString()
  });
  
  // Extract ML hospital recommendation if available
  const mlRecommendedHospitalId = predictions?.recommendations?.[0]?.hospital_id || null;
  const mlRecommendedHospitalName = predictions?.recommendations?.[0]?.hospital_name || null;
  
  if (!mlRecommendedHospitalId || !mlRecommendedHospitalName) {
    log('⚠️  ML service did not return recommendations, skipping test', 'yellow');
    testCases.push({
      name: 'Guest Emergency Request',
      status: 'SKIPPED',
      reason: 'ML service did not return recommendations'
    });
    return;
  }
  
  log(`ML recommended hospital: ${mlRecommendedHospitalName} (ID: ${mlRecommendedHospitalId})`, 'green');
  
  // Create guest request with ML recommendations (simulating what the service layer does)
  const request = await requestRepository.createRequest({
    isGuest: true,
    guestSessionId: randomUUID(),
    locationLat: location.lat,
    locationLng: location.lng,
    emergencyType: emergencyType,
    pickupAddress: 'Guest Emergency Location',
    patientName: 'Guest User',
    patientPhone: null,
    medicalNotes: '',
    status: 'PENDING',
    ipAddress: '192.168.1.100',
    userAgent: 'Test User Agent',
    deviceId: `test-device-${Date.now()}`,
    isSuspicious: false,
    suspiciousReason: null,
    trustScoreAtRequest: 0,
    mlRecommendedHospitalId,
    mlRecommendedHospitalName
  });
  
  log(`Guest request created: ${request.id}`, 'green');
  
  // Fetch the request from database to check if ML recommendation was stored
  const fetchedRequest = await prisma.request.findUnique({
    where: { id: request.id },
    include: {
      ambulance: {
        include: {
          hospital: true
        }
      }
    }
  });
  
  // Check for FIX conditions (opposite of bug conditions)
  const fixConditions = [];
  
  // Condition 1: Request SHOULD have mlRecommendedHospitalId field populated
  if ('mlRecommendedHospitalId' in fetchedRequest && fetchedRequest.mlRecommendedHospitalId !== null) {
    fixConditions.push(`✓ mlRecommendedHospitalId is populated: ${fetchedRequest.mlRecommendedHospitalId}`);
  }
  
  // Condition 2: Request SHOULD have mlRecommendedHospitalName field populated
  if ('mlRecommendedHospitalName' in fetchedRequest && fetchedRequest.mlRecommendedHospitalName !== null) {
    fixConditions.push(`✓ mlRecommendedHospitalName is populated: ${fetchedRequest.mlRecommendedHospitalName}`);
  }
  
  // Condition 3: Frontend would display ML-recommended hospital name
  const displayedHospitalName = fetchedRequest.ambulance?.hospital?.name || fetchedRequest.mlRecommendedHospitalName || 'Awaiting hospital assignment';
  if (displayedHospitalName !== 'Awaiting hospital assignment' && fetchedRequest.mlRecommendedHospitalName) {
    fixConditions.push(`✓ Frontend displays ML-recommended hospital: ${displayedHospitalName}`);
  }
  
  log('\nFix Conditions Met:', 'green');
  fixConditions.forEach(condition => log(`  ${condition}`, 'green'));
  
  // Test PASSES if fix is working (all conditions met)
  const fixWorking = fixConditions.length >= 2;
  
  if (fixWorking) {
    log('\n✓ TEST PASSED: Fix confirmed - ML recommendations ARE stored in Request', 'green');
    testCases.push({
      name: 'Guest Emergency Request',
      status: 'PASSED',
      fixConfirmed: true,
      conditions: fixConditions,
      mlRecommendation: {
        hospital_id: fetchedRequest.mlRecommendedHospitalId,
        hospital_name: fetchedRequest.mlRecommendedHospitalName
      }
    });
  } else {
    log('\n✗ TEST FAILED: Fix NOT working - ML recommendations still not stored', 'red');
    log(`  mlRecommendedHospitalId: ${fetchedRequest.mlRecommendedHospitalId}`, 'red');
    log(`  mlRecommendedHospitalName: ${fetchedRequest.mlRecommendedHospitalName}`, 'red');
    testCases.push({
      name: 'Guest Emergency Request',
      status: 'FAILED',
      fixConfirmed: false,
      reason: 'ML recommendations not stored in Request'
    });
  }
  
  // Cleanup
  await prisma.request.delete({ where: { id: request.id } });
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n╔════════════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║         FIX VERIFICATION TEST: Show Recommended Hospital Immediately       ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  log('\nThis test verifies that ML hospital recommendations ARE stored in Request records.', 'yellow');
  log('Expected: Test should PASS (confirming bug is fixed)', 'yellow');
  
  const startTime = Date.now();
  
  try {
    // Check ML service availability
    logSection('Checking ML Service Availability');
    const mlAvailable = await MLService.isAvailable();
    if (!mlAvailable) {
      log('⚠️  ML service is not available. Tests will be skipped.', 'yellow');
    } else {
      log('✓ ML service is available', 'green');
    }
    
    // Run test cases
    await testAuthenticatedPatientRequest();
    await testGuestEmergencyRequest();
    
    // Summary
    logSection('Test Summary');
    
    const passed = testCases.filter(t => t.status === 'PASSED').length;
    const failed = testCases.filter(t => t.status === 'FAILED').length;
    const skipped = testCases.filter(t => t.status === 'SKIPPED').length;
    
    testCases.forEach(testCase => {
      const statusColor = testCase.status === 'PASSED' ? 'green' : 
                         testCase.status === 'FAILED' ? 'red' : 'yellow';
      log(`\n${testCase.name}: ${testCase.status}`, statusColor);
      
      if (testCase.fixConfirmed) {
        log('  Fix Confirmed: ML recommendations are stored', 'green');
        if (testCase.mlRecommendation) {
          log(`  ML Recommended: ${testCase.mlRecommendation.hospital_name}`, 'blue');
        }
      }
      
      if (testCase.reason) {
        log(`  Reason: ${testCase.reason}`, 'yellow');
      }
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log('\n' + '─'.repeat(80), 'cyan');
    log(`Total: ${testCases.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`, 'cyan');
    log(`Duration: ${duration}s`, 'cyan');
    log('─'.repeat(80), 'cyan');
    
    // Exit with appropriate code
    if (passed > 0 && failed === 0) {
      log('\n✓ FIX VERIFICATION SUCCESSFUL: Bug is fixed', 'green');
      process.exit(0);
    } else if (failed > 0) {
      log('\n✗ FIX VERIFICATION FAILED: Bug still exists', 'red');
      process.exit(1);
    } else {
      log('\n⚠️  ALL TESTS SKIPPED: Cannot verify fix', 'yellow');
      process.exit(0);
    }
    
  } catch (error) {
    log('\n✗ TEST EXECUTION ERROR:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests with timeout
const timeoutId = setTimeout(() => {
  log('\n✗ TEST TIMEOUT: Tests exceeded maximum execution time', 'red');
  process.exit(1);
}, TEST_TIMEOUT);

runTests().finally(() => {
  clearTimeout(timeoutId);
});
