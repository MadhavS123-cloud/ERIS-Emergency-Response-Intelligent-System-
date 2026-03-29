import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hospitals = [
    {
      name: 'City General Emergency Dept',
      address: '456 Oak Street, Downtown',
      locationLat: 12.9635,
      locationLng: 77.6032,
      icuBedsAvailable: 12,
      generalBedsAvailable: 48,
      ventilatorsAvailable: 8,
      staffEmail: 'hospital1@eris.com',
      staffName: 'City General Dispatcher',
      staffPhone: '9000000001'
    },
    {
      name: 'St. Mary Trauma Center',
      address: '123 Pine Road, North View',
      locationLat: 13.0125,
      locationLng: 77.5896,
      icuBedsAvailable: 10,
      generalBedsAvailable: 36,
      ventilatorsAvailable: 6,
      staffEmail: 'hospital2@eris.com',
      staffName: 'St. Mary Dispatcher',
      staffPhone: '9000000002'
    },
    {
      name: 'Apollo Speciality Clinic',
      address: 'Old Airport Road Junction',
      locationLat: 12.9498,
      locationLng: 77.6681,
      icuBedsAvailable: 8,
      generalBedsAvailable: 30,
      ventilatorsAvailable: 5,
      staffEmail: 'hospital3@eris.com',
      staffName: 'Apollo Dispatcher',
      staffPhone: '9000000003'
    },
    {
      name: 'Lakeside Multispeciality Hospital',
      address: 'Outer Ring Road, Bellandur',
      locationLat: 12.9301,
      locationLng: 77.6784,
      icuBedsAvailable: 11,
      generalBedsAvailable: 42,
      ventilatorsAvailable: 7,
      staffEmail: 'hospital4@eris.com',
      staffName: 'Lakeside Dispatcher',
      staffPhone: '9000000004'
    },
    {
      name: 'Bengaluru North Emergency Institute',
      address: 'Hebbal Main Road, Bengaluru',
      locationLat: 13.0369,
      locationLng: 77.5970,
      icuBedsAvailable: 14,
      generalBedsAvailable: 52,
      ventilatorsAvailable: 9,
      staffEmail: 'hospital5@eris.com',
      staffName: 'North Command Dispatcher',
      staffPhone: '9000000005'
    }
  ];

  const password = await bcrypt.hash('password123', 10);

  for (const hospitalData of hospitals) {
    const bedCapacity = hospitalData.icuBedsAvailable + hospitalData.generalBedsAvailable;
    const hospitalId = `hosp-${hospitalData.name.replace(/\s/g, '').toLowerCase()}`;

    const hospital = await prisma.hospital.upsert({
      where: { id: hospitalId },
      update: {
        name: hospitalData.name,
        address: hospitalData.address,
        locationLat: hospitalData.locationLat,
        locationLng: hospitalData.locationLng,
        bedCapacity,
        icuBedsAvailable: hospitalData.icuBedsAvailable,
        generalBedsAvailable: hospitalData.generalBedsAvailable,
        ventilatorsAvailable: hospitalData.ventilatorsAvailable
      },
      create: {
        id: hospitalId,
        name: hospitalData.name,
        address: hospitalData.address,
        locationLat: hospitalData.locationLat,
        locationLng: hospitalData.locationLng,
        bedCapacity,
        icuBedsAvailable: hospitalData.icuBedsAvailable,
        generalBedsAvailable: hospitalData.generalBedsAvailable,
        ventilatorsAvailable: hospitalData.ventilatorsAvailable
      }
    });

    await prisma.user.upsert({
      where: { email: hospitalData.staffEmail },
      update: {
        name: hospitalData.staffName,
        password,
        role: 'HOSPITAL',
        hospitalId: hospital.id,
        phone: hospitalData.staffPhone
      },
      create: {
        email: hospitalData.staffEmail,
        name: hospitalData.staffName,
        password,
        role: 'HOSPITAL',
        hospitalId: hospital.id,
        phone: hospitalData.staffPhone
      }
    });
  }

  console.log(`Hospitals and hospital staff seeded successfully: ${hospitals.length} hospitals ready`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
