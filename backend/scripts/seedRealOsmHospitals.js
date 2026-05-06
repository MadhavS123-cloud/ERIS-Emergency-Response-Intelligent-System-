import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── Facility Classification ───────────────────────────────────────────────────
// Based on OSM tags and name heuristics, classify each facility accurately.

const NON_EMERGENCY_PATTERNS = [
  /diagnostic/i, /srl/i, /pathlab/i, /path lab/i, /lab/i, /laboratory/i,
  /scan/i, /imaging/i, /radiology/i, /dental/i, /dentist/i, /eye/i,
  /optic/i, /optical/i, /vision/i, /veterinar/i, /animal/i, /pet/i,
  /ayurved/i, /homeopath/i, /naturopath/i, /yoga/i, /wellness/i,
  /beauty/i, /skin/i, /cosmet/i, /physiotherap/i, /rehab/i,
  /blood bank/i, /nursing home/i, /maternity/i, /day care/i,
  /pharmacy/i, /dispensary/i, /chemist/i, /drug/i, /store/i,
  /dialysis/i, /fertility/i, /ivf/i,
];

const MULTISPECIALITY_PATTERNS = [
  /multispeciali/i, /multi.speciali/i, /super speciali/i, /superspeciali/i,
  /apollo/i, /fortis/i, /manipal/i, /narayana/i, /aster/i, /columbia asia/i,
  /sakra/i, /bg[s]?/i, /sparsh/i, /jayadeva/i, /nimhans/i, /kidwai/i,
  /bowring/i, /victoria/i, /st\. john/i, /saint john/i, /ms ramaiah/i,
  /ramaiah/i, /kims/i, /bgr/i, /healthcare/i, /health city/i, /institute/i,
  /medical college/i, /medical center/i, /health center/i,
];

const CLINIC_PATTERNS = [
  /clinic/i, /polyclinic/i, /dispensary/i, /outpatient/i, /centre$/i,
];

function classifyFacility(tags) {
  const name = (tags.name || '').toLowerCase();
  const osmType = (tags.healthcare || tags['amenity'] || '').toLowerCase();

  // Hard non-emergency exclusions — these should never dispatch ambulances to
  for (const pattern of NON_EMERGENCY_PATTERNS) {
    if (pattern.test(name)) {
      return { facilityType: 'diagnostic', isEmergencyCapable: false };
    }
  }

  if (osmType === 'clinic' || osmType === 'dentist' || osmType === 'doctors') {
    return { facilityType: 'clinic', isEmergencyCapable: false };
  }

  for (const pattern of CLINIC_PATTERNS) {
    if (pattern.test(name)) {
      return { facilityType: 'clinic', isEmergencyCapable: false };
    }
  }

  // Multispeciality hospitals — highest priority for critical emergencies
  for (const pattern of MULTISPECIALITY_PATTERNS) {
    if (pattern.test(name)) {
      return { facilityType: 'multispeciality', isEmergencyCapable: true };
    }
  }

  // Default: treat as a general hospital, emergency capable
  return { facilityType: 'hospital', isEmergencyCapable: true };
}

// ── OSM Fetch ─────────────────────────────────────────────────────────────────
async function fetchRealHospitals() {
  console.log('📡 Fetching REAL hospital data from OpenStreetMap (Bangalore)...');

  // Include hospitals, clinics, and healthcare facilities
  const overpassQuery = `
    [out:json][timeout:30];
    (
      node["amenity"~"hospital|clinic"](12.7,77.4,13.2,77.8);
      way["amenity"~"hospital|clinic"](12.7,77.4,13.2,77.8);
      relation["amenity"~"hospital|clinic"](12.7,77.4,13.2,77.8);
      node["healthcare"~"hospital|clinic|centre"](12.7,77.4,13.2,77.8);
      way["healthcare"~"hospital|clinic|centre"](12.7,77.4,13.2,77.8);
    );
    out center tags;
  `;

  const url = 'https://overpass-api.de/api/interpreter';

  try {
    const response = await axios.get(url + '?data=' + encodeURIComponent(overpassQuery), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ERIS-Emergency-Response-System-Seeder/1.0'
      }
    });

    const elements = response.data.elements;
    const hospitals = [];
    const seenNames = new Set();

    for (const e of elements) {
      if (!e.tags?.name) continue;
      const name = e.tags.name.trim();
      if (seenNames.has(name)) continue;
      seenNames.add(name);

      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (!lat || !lon) continue;

      const { facilityType, isEmergencyCapable } = classifyFacility(e.tags);

      // Bed capacity from OSM data if available, otherwise realistic defaults
      const isMulti = facilityType === 'multispeciality';
      const defaultBeds = isMulti
        ? Math.floor(Math.random() * 400) + 150
        : facilityType === 'hospital'
          ? Math.floor(Math.random() * 150) + 50
          : Math.floor(Math.random() * 30) + 10;

      const bedCapacity = parseInt(e.tags.capacity || e.tags.beds || defaultBeds);
      const icuBeds = isMulti
        ? Math.floor(bedCapacity * 0.25)
        : Math.floor(bedCapacity * 0.15);

      hospitals.push({
        id: `hosp-${Math.random().toString(36).substring(2, 11)}`,
        name,
        address: e.tags['addr:full'] || e.tags['addr:street'] || e.tags['addr:city'] || 'Bengaluru, Karnataka',
        locationLat: lat,
        locationLng: lon,
        bedCapacity,
        icuBedsAvailable: icuBeds,
        generalBedsAvailable: bedCapacity - icuBeds,
        ventilatorsAvailable: Math.floor(icuBeds * 0.5),
        facilityType,
        isEmergencyCapable,
      });
    }

    const capable = hospitals.filter(h => h.isEmergencyCapable).length;
    const notCapable = hospitals.length - capable;
    console.log(`✅ Fetched ${hospitals.length} facilities: ${capable} emergency-capable, ${notCapable} non-emergency (labs/clinics).`);
    return hospitals;
  } catch (error) {
    console.error('❌ Overpass API error:', error.message);
    return [];
  }
}

// ── Database Wipe ─────────────────────────────────────────────────────────────
async function cleanDatabase() {
  console.log('🧹 Wiping old data...');
  await prisma.request.deleteMany();
  await prisma.ambulance.deleteMany();
  await prisma.user.deleteMany({ where: { role: { in: ['DRIVER', 'HOSPITAL'] } } });
  await prisma.hospital.deleteMany();
  console.log('✅ Database wiped.');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  await cleanDatabase();

  const allFacilities = await fetchRealHospitals();
  if (allFacilities.length === 0) {
    console.error('❌ No facilities fetched. Aborting.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('💾 Inserting hospitals/facilities into DB...');
  for (let i = 0; i < allFacilities.length; i += 500) {
    const chunk = allFacilities.slice(i, i + 500);
    await prisma.hospital.createMany({ data: chunk, skipDuplicates: true });
  }

  // Only assign ambulances to emergency-capable facilities
  const emergencyHospitals = await prisma.hospital.findMany({
    where: { isEmergencyCapable: true }
  });

  console.log(`🚑 Assigning 10 ambulances/drivers to each of the ${emergencyHospitals.length} emergency-capable hospitals...`);

  const driverData = [];
  const ambulanceData = [];
  const hospitalUserData = [];
  let counter = 1;

  for (const hosp of emergencyHospitals) {
    const hospitalUserId = `husr-${Math.random().toString(36).substring(2, 11)}-${counter}`;
    hospitalUserData.push({
      id: hospitalUserId,
      name: hosp.name.substring(0, 50),
      email: `hospital${counter}@eris.local`,
      password: passwordHash,
      role: 'HOSPITAL',
      hospitalId: hosp.id,
      phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`.substring(0, 12),
    });

    for (let a = 0; a < 10; a++) {
      const driverId = `drv-${Math.random().toString(36).substring(2, 11)}-${counter}`;
      driverData.push({
        id: driverId,
        name: `Driver ${a + 1} - ${hosp.name.substring(0, 20)}`,
        email: `driver${counter}@eris.local`,
        password: passwordHash,
        role: 'DRIVER',
        phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`.substring(0, 12),
      });
      ambulanceData.push({
        id: `amb-${Math.random().toString(36).substring(2, 11)}-${counter}`,
        driverId,
        hospitalId: hosp.id,
        plateNumber: `KA-${Math.floor(10 + Math.random() * 89)}-${Math.floor(10 + Math.random() * 89)}-${Math.floor(1000 + Math.random() * 9000)}`,
        locationLat: hosp.locationLat + (Math.random() * 0.005 - 0.0025),
        locationLng: hosp.locationLng + (Math.random() * 0.005 - 0.0025),
        isAvailable: true,
      });
      counter++;
    }
  }

  console.log(`👤 Inserting ${hospitalUserData.length} hospital users...`);
  for (let i = 0; i < hospitalUserData.length; i += 2000) {
    await prisma.user.createMany({ data: hospitalUserData.slice(i, i + 2000), skipDuplicates: true });
  }

  console.log(`👤 Inserting ${driverData.length} drivers...`);
  for (let i = 0; i < driverData.length; i += 2000) {
    await prisma.user.createMany({ data: driverData.slice(i, i + 2000), skipDuplicates: true });
  }

  console.log(`🚐 Inserting ${ambulanceData.length} ambulances...`);
  for (let i = 0; i < ambulanceData.length; i += 2000) {
    await prisma.ambulance.createMany({ data: ambulanceData.slice(i, i + 2000), skipDuplicates: true });
  }

  const summary = allFacilities.reduce((acc, h) => {
    acc[h.facilityType] = (acc[h.facilityType] || 0) + 1;
    return acc;
  }, {});

  console.log('\n✅ Seeding complete! Summary:');
  console.table(summary);
  console.log(`Total ambulances deployed: ${ambulanceData.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
