
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding Ambulances and Drivers for all hospitals...');
  
  const password = await bcrypt.hash('password123', 10);
  const hospitals = await prisma.hospital.findMany();

  if (hospitals.length === 0) {
    console.error('❌ No hospitals found. Run seedRealHospitals.js first.');
    return;
  }

  let ambulanceCount = 0;
  let driverCount = 0;

  for (const hospital of hospitals) {
    // Seed 2-4 ambulances for each hospital
    const numAmbulances = Math.floor(Math.random() * 3) + 2; 

    for (let i = 1; i <= numAmbulances; i++) {
      const plateNumber = `KA-01-AMB-${Math.floor(1000 + Math.random() * 9000)}`;
      const driverEmail = `driver.${hospital.id.replace('hosp-', '')}.${i}@eris.com`;
      const driverName = `Driver ${i} (${hospital.name})`;

      // Create Driver User
      const driver = await prisma.user.upsert({
        where: { email: driverEmail },
        update: {
          name: driverName,
          password,
          role: 'DRIVER',
          phone: `9123456${Math.floor(100 + Math.random() * 899)}`
        },
        create: {
          email: driverEmail,
          name: driverName,
          password,
          role: 'DRIVER',
          phone: `9123456${Math.floor(100 + Math.random() * 899)}`
        }
      });

      // Create Ambulance
      await prisma.ambulance.create({
        data: {
          plateNumber,
          hospitalId: hospital.id,
          driverId: driver.id,
          isAvailable: true,
          locationLat: hospital.locationLat + (Math.random() - 0.5) * 0.01,
          locationLng: hospital.locationLng + (Math.random() - 0.5) * 0.01
        }
      });

      ambulanceCount++;
      driverCount++;
    }
    console.log(`✅ Seeded ${numAmbulances} units for ${hospital.name}`);
  }

  console.log(`\n🎉 Successfully seeded ${ambulanceCount} ambulances and ${driverCount} drivers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
