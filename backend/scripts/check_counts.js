
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkData() {
  try {
    const hospitalCount = await prisma.hospital.count();
    const ambulanceCount = await prisma.ambulance.count();
    const availableAmbulanceCount = await prisma.ambulance.count({
      where: { isAvailable: true }
    });
    const hospitals = await prisma.hospital.findMany();
    const bedSum = hospitals.reduce((acc, h) => acc + (h.bedCapacity || 0), 0);
    const icuSum = hospitals.reduce((acc, h) => acc + (h.icuBedsAvailable || 0), 0);
    const genSum = hospitals.reduce((acc, h) => acc + (h.generalBedsAvailable || 0), 0);

    console.log('--- Database Check ---');
    console.log('Total Hospitals:', hospitalCount);
    console.log('Total Ambulances:', ambulanceCount);
    console.log('Available Ambulances:', availableAmbulanceCount);
    console.log('Total bedCapacity Sum:', bedSum);
    console.log('Total icuBedsAvailable Sum:', icuSum);
    console.log('Total generalBedsAvailable Sum:', genSum);
    
    if (hospitalCount > 0) {
      console.log('Sample Hospitals (Top 5):');
      hospitals.slice(0, 5).forEach(h => {
        console.log(`- ${h.name} (${h.id}) - Beds: ${h.bedCapacity}, ICU: ${h.icuBedsAvailable}, Gen: ${h.generalBedsAvailable}`);
      });
    } else {
      console.log('No hospitals found in database.');
    }

  } catch (err) {
    console.error('Error checking database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
