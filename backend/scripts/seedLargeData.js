import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting large data seed...');
  const password = await bcrypt.hash('password123', 10);

  const numHospitals = 2000;
  const ambulancesPerHospital = 10;

  console.log(`Generating ${numHospitals} hospitals...`);
  const hospitals = [];
  const hospitalStaffUsers = [];

  for (let i = 1; i <= numHospitals; i++) {
    const hospitalId = `hosp-large-${i}`;
    hospitals.push({
      id: hospitalId,
      name: `Global Hospital Node ${i}`,
      address: `Sector ${i}, Metropolis`,
      locationLat: 12.0 + (Math.random() * 2),
      locationLng: 77.0 + (Math.random() * 2),
      bedCapacity: 100,
      icuBedsAvailable: Math.floor(Math.random() * 20) + 5,
      generalBedsAvailable: Math.floor(Math.random() * 50) + 20,
      ventilatorsAvailable: Math.floor(Math.random() * 10) + 2
    });

    hospitalStaffUsers.push({
      id: `staff-large-${i}`,
      email: `hospital${i}@eris-node.com`,
      name: `Hospital ${i} Dispatcher`,
      password,
      role: 'HOSPITAL',
      hospitalId,
      phone: `9000${String(i).padStart(6, '0')}`
    });
  }

  // Insert Hospitals in batches
  console.log('Inserting Hospitals...');
  for (let i = 0; i < hospitals.length; i += 500) {
    await prisma.hospital.createMany({
      data: hospitals.slice(i, i + 500),
      skipDuplicates: true,
    });
  }

  // Insert Hospital Staff in batches
  console.log('Inserting Hospital Staff...');
  for (let i = 0; i < hospitalStaffUsers.length; i += 500) {
    await prisma.user.createMany({
      data: hospitalStaffUsers.slice(i, i + 500),
      skipDuplicates: true,
    });
  }

  console.log(`Generating ${numHospitals * ambulancesPerHospital} drivers & ambulances...`);
  const drivers = [];
  const ambulances = [];

  for (let i = 1; i <= numHospitals; i++) {
    const hospitalId = `hosp-large-${i}`;
    for (let j = 1; j <= ambulancesPerHospital; j++) {
      const driverIndex = (i - 1) * ambulancesPerHospital + j;
      const driverId = `driver-large-${driverIndex}`;
      
      drivers.push({
        id: driverId,
        email: `driver${driverIndex}@eris-node.com`,
        name: `EMS Driver ${driverIndex}`,
        password,
        role: 'DRIVER',
        hospitalId,
        phone: `9888${String(driverIndex).padStart(6, '0')}`
      });

      ambulances.push({
        id: `amb-large-${driverIndex}`,
        driverId,
        hospitalId,
        plateNumber: `KA-AMB-${String(driverIndex).padStart(5, '0')}`,
        locationLat: 12.0 + (Math.random() * 2),
        locationLng: 77.0 + (Math.random() * 2),
        isAvailable: true
      });
    }
  }

  console.log('Inserting Drivers...');
  for (let i = 0; i < drivers.length; i += 5000) {
    await prisma.user.createMany({
      data: drivers.slice(i, i + 5000),
      skipDuplicates: true,
    });
  }

  console.log('Inserting Ambulances...');
  for (let i = 0; i < ambulances.length; i += 5000) {
    await prisma.ambulance.createMany({
      data: ambulances.slice(i, i + 5000),
      skipDuplicates: true,
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
