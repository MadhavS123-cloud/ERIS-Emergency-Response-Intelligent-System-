import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BANGALORE_CENTER = { lat: 12.9716, lng: 77.5946 };
const RADIUS_DEG = 0.3; // Approx 30km spread

const PREFIXES = ["Apollo", "Fortis", "Manipal", "Narayana", "Aster", "Columbia Asia", "Sakra", "BGS", "HCG", "Sparsh", "Global", "City", "Metro", "Care", "Life", "Prime", "Apex", "Nova", "Cure", "Heal"];
const SUFFIXES = ["Hospital", "Medical Center", "Health City", "Clinic", "Super Speciality", "Institute of Medical Sciences"];
const LOCATIONS = ["Whitefield", "Koramangala", "Indiranagar", "Jayanagar", "JP Nagar", "HSR Layout", "BTM Layout", "Electronic City", "Bellandur", "Marathahalli", "Yelahanka", "Hebbal", "Malleswaram", "Rajajinagar", "Basavanagudi", "Banashankari", "RR Nagar", "Kengeri", "Yeshwanthpur", "Peenya"];

function generateHospitals(count) {
    const hospitals = [];
    let idCounter = 1;
    for (let i = 0; i < count; i++) {
        const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
        const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
        const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
        
        const name = `${prefix} ${suffix} ${loc} ${idCounter++}`;
        
        // Random location around Bangalore
        const lat = BANGALORE_CENTER.lat + (Math.random() * 2 - 1) * RADIUS_DEG;
        const lng = BANGALORE_CENTER.lng + (Math.random() * 2 - 1) * RADIUS_DEG;
        
        const icuBeds = Math.floor(Math.random() * 30) + 10;
        const generalBeds = Math.floor(Math.random() * 100) + 50;
        const ventilators = Math.floor(Math.random() * 15) + 5;
        
        hospitals.push({
            id: `hosp-${Math.random().toString(36).substr(2, 9)}-${i}`,
            name,
            address: `${loc}, Bengaluru, Karnataka`,
            locationLat: lat,
            locationLng: lng,
            bedCapacity: icuBeds + generalBeds,
            icuBedsAvailable: icuBeds,
            generalBedsAvailable: generalBeds,
            ventilatorsAvailable: ventilators,
        });
    }
    return hospitals;
}

async function main() {
    console.log('🚀 Starting massive seeding: 2000 Hospitals, 20000 Ambulances/Drivers...');
    
    // Clear existing data (optional, but good for a clean slate if requested)
    // await prisma.ambulance.deleteMany();
    // await prisma.user.deleteMany({ where: { role: { in: ['DRIVER', 'HOSPITAL'] } } });
    // await prisma.hospital.deleteMany();

    const hospitalData = generateHospitals(2000);
    const passwordHash = await bcrypt.hash('password123', 10);
    
    console.log(`Prepared ${hospitalData.length} hospital records.`);

    // Batch insert hospitals
    console.log('Inserting Hospitals...');
    // Split into chunks of 500
    for(let i=0; i<hospitalData.length; i+=500) {
        const chunk = hospitalData.slice(i, i+500);
        await prisma.hospital.createMany({ data: chunk, skipDuplicates: true });
        console.log(`Inserted ${i + chunk.length} / 2000 hospitals`);
    }

    // Now insert drivers and ambulances
    // We need hospital IDs. Let's fetch them all.
    const allHospitals = await prisma.hospital.findMany({ select: { id: true, locationLat: true, locationLng: true } });
    
    console.log('Generating Drivers and Ambulances...');
    let driverData = [];
    let ambulanceData = [];
    
    let counter = 1;
    for (const hosp of allHospitals) {
        for (let a = 0; a < 10; a++) {
            const driverId = `drv-${Math.random().toString(36).substr(2, 9)}-${counter}`;
            driverData.push({
                id: driverId,
                name: `Driver ${a+1} - Hosp ${hosp.id.substring(0,5)}`,
                email: `driver${counter}@eris.local`,
                password: passwordHash,
                role: 'DRIVER',
                phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`
            });
            
            ambulanceData.push({
                id: `amb-${Math.random().toString(36).substr(2, 9)}-${counter}`,
                driverId: driverId,
                hospitalId: hosp.id,
                plateNumber: `KA-01-M-${Math.floor(1000 + Math.random() * 9000)}`,
                locationLat: hosp.locationLat + (Math.random() * 0.01 - 0.005),
                locationLng: hosp.locationLng + (Math.random() * 0.01 - 0.005),
                isAvailable: true
            });
            counter++;
        }
    }

    console.log(`Inserting ${driverData.length} Drivers...`);
    for(let i=0; i<driverData.length; i+=2000) {
        const chunk = driverData.slice(i, i+2000);
        await prisma.user.createMany({ data: chunk, skipDuplicates: true });
        console.log(`Inserted ${i + chunk.length} drivers`);
    }

    console.log(`Inserting ${ambulanceData.length} Ambulances...`);
    for(let i=0; i<ambulanceData.length; i+=2000) {
        const chunk = ambulanceData.slice(i, i+2000);
        await prisma.ambulance.createMany({ data: chunk, skipDuplicates: true });
        console.log(`Inserted ${i + chunk.length} ambulances`);
    }

    console.log('✅ Seeding Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
