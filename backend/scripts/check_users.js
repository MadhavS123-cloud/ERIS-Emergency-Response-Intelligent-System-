import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const drivers = await prisma.user.findMany({
      where: { role: 'DRIVER' },
      take: 10
    });
    console.log('--- Sample Drivers ---');
    drivers.forEach(d => {
      console.log(`- Name: ${d.name}, Email: ${d.email}, Role: ${d.role}`);
    });

    const specificDriver = await prisma.user.findUnique({
      where: { email: 'driver202@eris.local' }
    });
    if (specificDriver) {
      console.log('--- Specific Driver Found ---');
      console.log(`- Name: ${specificDriver.name}, Email: ${specificDriver.email}, Role: ${specificDriver.role}`);
    } else {
      console.log('--- Specific Driver driver202@eris.local NOT found ---');
    }

  } catch (err) {
    console.error('Error checking users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
