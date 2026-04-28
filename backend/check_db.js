import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ambulanceCount = await prisma.ambulance.count();
  const availableCount = await prisma.ambulance.count({ where: { isAvailable: true } });
  const withDriverCount = await prisma.ambulance.count({ where: { driverId: { not: null } } });
  const hospitals = await prisma.hospital.findMany({ select: { id: true, name: true } });
  
  console.log({
    totalAmbulances: ambulanceCount,
    available: availableCount,
    withDriver: withDriverCount,
    hospitals: hospitals.map(h => h.name)
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
