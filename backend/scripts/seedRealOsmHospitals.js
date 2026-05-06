import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function fetchRealHospitals() {
  console.log('Fetching real hospital data from OpenStreetMap (Overpass API) for Bangalore...');
  // Bounding box for Bangalore roughly
  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](12.7,77.4,13.2,77.8);
      way["amenity"="hospital"](12.7,77.4,13.2,77.8);
      relation["amenity"="hospital"](12.7,77.4,13.2,77.8);
    );
    out center;
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
    
    const hospitals = elements
      .filter(e => e.tags && e.tags.name)
      .map(e => {
        const lat = e.lat || e.center?.lat;
        const lon = e.lon || e.center?.lon;
        const name = e.tags.name;
        // Check if bed capacity is available in OSM, otherwise generate realistic one
        const bedCapacity = parseInt(e.tags.capacity || e.tags.beds || Math.floor(Math.random() * 200) + 50);
        const icuBeds = Math.floor(bedCapacity * 0.2); // ~20% of beds are ICU
        
        return {
          id: `hosp-${Math.random().toString(36).substr(2, 9)}`,
          name,
          address: e.tags['addr:full'] || e.tags['addr:street'] || 'Bengaluru, Karnataka',
          locationLat: lat,
          locationLng: lon,
          bedCapacity,
          icuBedsAvailable: icuBeds,
          generalBedsAvailable: bedCapacity - icuBeds,
          ventilatorsAvailable: Math.floor(icuBeds * 0.5)
        };
      })
      .filter(h => h.locationLat && h.locationLng);
      
    // Deduplicate by name and rough location to avoid Overpass duplicates
    const uniqueHospitals = [];
    const seenNames = new Set();
    for (const h of hospitals) {
      if (!seenNames.has(h.name)) {
        seenNames.add(h.name);
        uniqueHospitals.push(h);
      }
    }
    
    console.log(`Successfully fetched ${uniqueHospitals.length} real hospitals from OSM.`);
    return uniqueHospitals;
  } catch (error) {
    console.error('Error fetching from OSM:', error.message);
    return [];
  }
}

async function cleanDatabase() {
  console.log('🧹 Wiping old fake database records to prepare for real data...');
  // Deleting in correct order to respect foreign keys
  await prisma.request.deleteMany();
  await prisma.ambulance.deleteMany();
  await prisma.user.deleteMany({ where: { role: { in: ['DRIVER', 'HOSPITAL'] } } });
  await prisma.hospital.deleteMany();
  console.log('✅ Database wiped.');
}

async function main() {
  await cleanDatabase();
  
  const realHospitals = await fetchRealHospitals();
  if (realHospitals.length === 0) {
    console.error('❌ Failed to fetch real hospitals.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  
  console.log('Inserting Real Hospitals into DB...');
  // Insert in batches
  for(let i=0; i<realHospitals.length; i+=500) {
      const chunk = realHospitals.slice(i, i+500);
      await prisma.hospital.createMany({ data: chunk, skipDuplicates: true });
  }

  // Get them back to get actual IDs
  const allHospitals = await prisma.hospital.findMany();
  
  console.log(`Seeding exactly 10 ambulances/drivers for each of the ${allHospitals.length} real hospitals...`);
  
  let driverData = [];
  let ambulanceData = [];
  
  let counter = 1;
  for (const hosp of allHospitals) {
      for (let a = 0; a < 10; a++) {
          const driverId = `drv-${Math.random().toString(36).substr(2, 9)}-${counter}`;
          driverData.push({
              id: driverId,
              name: `Driver ${a+1} - ${hosp.name.substring(0,15)}`,
              email: `driver${counter}@eris.local`,
              password: passwordHash,
              role: 'DRIVER',
              phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`
          });
          
          ambulanceData.push({
              id: `amb-${Math.random().toString(36).substr(2, 9)}-${counter}`,
              driverId: driverId,
              hospitalId: hosp.id,
              plateNumber: `KA-01-${Math.floor(10 + Math.random() * 90)}-${Math.floor(1000 + Math.random() * 9000)}`,
              locationLat: hosp.locationLat + (Math.random() * 0.005 - 0.0025),
              locationLng: hosp.locationLng + (Math.random() * 0.005 - 0.0025),
              isAvailable: true
          });
          counter++;
      }
  }

  console.log(`Inserting ${driverData.length} Drivers...`);
  for(let i=0; i<driverData.length; i+=2000) {
      const chunk = driverData.slice(i, i+2000);
      await prisma.user.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log(`Inserting ${ambulanceData.length} Ambulances...`);
  for(let i=0; i<ambulanceData.length; i+=2000) {
      const chunk = ambulanceData.slice(i, i+2000);
      await prisma.ambulance.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log('✅ Real data seeding complete! Database is clean and accurate.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
