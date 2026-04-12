/**
 * Simple Fix Verification Test
 * 
 * Verifies that:
 * 1. Database schema has mlRecommendedHospitalId and mlRecommendedHospitalName fields
 * 2. These fields can be stored and retrieved
 * 3. Frontend logic would display the ML recommendation
 */

import { prisma } from '../src/config/db.js';
import { randomUUID } from 'crypto';

// Color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTest() {
  log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║         ML Hospital Recommendation Fix Verification           ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════╝', 'cyan');
  
  try {
    // Create test patient
    log('\n1. Creating test patient...', 'cyan');
    const testPatient = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: 'Test Patient',
        email: `test-${Date.now()}@example.com`,
        password: 'hashed_password',
        phone: '9876543210',
        role: 'PATIENT'
      }
    });
    log('✓ Test patient created', 'green');
    
    // Get a real hospital from database
    log('\n2. Fetching a real hospital from database...', 'cyan');
    const hospital = await prisma.hospital.findFirst({
      where: {
        locationLat: { not: null },
        locationLng: { not: null }
      }
    });
    
    if (!hospital) {
      log('✗ No hospitals in database', 'red');
      process.exit(1);
    }
    log(`✓ Found hospital: ${hospital.name}`, 'green');
    
    // Create request with ML recommendation fields
    log('\n3. Creating request with ML recommendation fields...', 'cyan');
    const request = await prisma.request.create({
      data: {
        patientId: testPatient.id,
        locationLat: 28.6139,
        locationLng: 77.2090,
        emergencyType: 'Cardiac Arrest',
        pickupAddress: 'Test Address',
        patientName: testPatient.name,
        patientPhone: testPatient.phone,
        medicalNotes: 'Test medical notes',
        status: 'PENDING',
        mlRecommendedHospitalId: hospital.id,
        mlRecommendedHospitalName: hospital.name
      },
      include: {
        ambulance: {
          include: {
            hospital: true
          }
        }
      }
    });
    log('✓ Request created with ML recommendation fields', 'green');
    
    // Verify fields are stored
    log('\n4. Verifying ML recommendation fields are stored...', 'cyan');
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
    
    const checks = [];
    
    if (fetchedRequest.mlRecommendedHospitalId === hospital.id) {
      checks.push('✓ mlRecommendedHospitalId stored correctly');
      log(`  mlRecommendedHospitalId: ${fetchedRequest.mlRecommendedHospitalId}`, 'green');
    } else {
      checks.push('✗ mlRecommendedHospitalId NOT stored correctly');
      log(`  Expected: ${hospital.id}`, 'red');
      log(`  Got: ${fetchedRequest.mlRecommendedHospitalId}`, 'red');
    }
    
    if (fetchedRequest.mlRecommendedHospitalName === hospital.name) {
      checks.push('✓ mlRecommendedHospitalName stored correctly');
      log(`  mlRecommendedHospitalName: ${fetchedRequest.mlRecommendedHospitalName}`, 'green');
    } else {
      checks.push('✗ mlRecommendedHospitalName NOT stored correctly');
      log(`  Expected: ${hospital.name}`, 'red');
      log(`  Got: ${fetchedRequest.mlRecommendedHospitalName}`, 'red');
    }
    
    // Verify frontend display logic
    log('\n5. Verifying frontend display logic...', 'cyan');
    
    // Simulate frontend mapping (from ErisContext.jsx)
    const hospitalName = fetchedRequest.ambulance?.hospital?.name || fetchedRequest.mlRecommendedHospitalName || 'Awaiting hospital assignment';
    
    if (hospitalName === hospital.name) {
      checks.push('✓ Frontend displays ML-recommended hospital');
      log(`  Frontend would display: "${hospitalName}"`, 'green');
    } else {
      checks.push('✗ Frontend does NOT display ML-recommended hospital');
      log(`  Expected: "${hospital.name}"`, 'red');
      log(`  Got: "${hospitalName}"`, 'red');
    }
    
    // Cleanup
    log('\n6. Cleaning up test data...', 'cyan');
    await prisma.request.delete({ where: { id: request.id } });
    await prisma.user.delete({ where: { id: testPatient.id } });
    log('✓ Test data cleaned up', 'green');
    
    // Summary
    log('\n' + '═'.repeat(64), 'cyan');
    log('Test Summary:', 'cyan');
    checks.forEach(check => log(`  ${check}`, check.startsWith('✓') ? 'green' : 'red'));
    log('═'.repeat(64), 'cyan');
    
    const allPassed = checks.every(check => check.startsWith('✓'));
    
    if (allPassed) {
      log('\n✓ ALL CHECKS PASSED: Fix is working correctly!', 'green');
      process.exit(0);
    } else {
      log('\n✗ SOME CHECKS FAILED: Fix is not working correctly', 'red');
      process.exit(1);
    }
    
  } catch (error) {
    log('\n✗ TEST ERROR:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
