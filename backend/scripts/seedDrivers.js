import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const ambulancesPerHospital = 10;
  const hospitals = await prisma.hospital.findMany({
    orderBy: { name: 'asc' }
  });

  if (hospitals.length === 0) {
    throw new Error('Seed hospitals first so ambulances can be attached to a hospital.');
  }

  const driverData = Array.from({ length: hospitals.length * ambulancesPerHospital }, (_, index) => {
    const sequence = index + 1;
    const hospital = hospitals[Math.floor(index / ambulancesPerHospital)];

    return {
      name: sequence === 1 ? 'Driver John' : sequence === 2 ? 'Driver Mike' : `EMS Driver ${String(sequence).padStart(2, '0')}`,
      email: sequence <= 2 ? `driver${sequence}@eris.com` : `driver${String(sequence).padStart(2, '0')}@eris.com`,
      phone: `98888${String(70000 + sequence).slice(-5)}`,
      plate: `KA-${String((sequence % 30) + 1).padStart(2, '0')}-AMB-${String(100 + sequence).padStart(3, '0')}`,
      hospitalId: hospital.id,
      locationLat: hospital.locationLat ?? 12.9716,
      locationLng: hospital.locationLng ?? 77.5946
    };
  });

  for (const data of driverData) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {
        name: data.name,
        phone: data.phone,
        password: hashedPassword,
        role: 'DRIVER',
        hospitalId: data.hospitalId
      },
      create: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
        role: 'DRIVER',
        hospitalId: data.hospitalId,
        phone: data.phone
      }
    });

    await prisma.ambulance.upsert({
      where: { driverId: user.id },
      update: {
        plateNumber: data.plate,
        hospitalId: data.hospitalId,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        isAvailable: true
      },
      create: {
        driverId: user.id,
        hospitalId: data.hospitalId,
        plateNumber: data.plate,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        isAvailable: true
      }
    });
  }

  console.log(`Drivers and ambulances seeded successfully: ${driverData.length} ambulances across ${hospitals.length} hospitals (${ambulancesPerHospital} per hospital)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
