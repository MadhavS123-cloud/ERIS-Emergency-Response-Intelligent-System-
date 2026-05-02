import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up fake hospitals...');
  
  // Find all fake hospitals (Global Hospital Node)
  const fakeHospitals = await prisma.hospital.findMany({
    where: {
      name: {
        startsWith: 'Global Hospital Node'
      }
    },
    select: { id: true, name: true }
  });
  
  console.log(`Found ${fakeHospitals.length} fake hospitals to delete`);
  
  // Delete in batches to avoid overwhelming the database
  const batchSize = 100;
  let deleted = 0;
  
  for (let i = 0; i < fakeHospitals.length; i += batchSize) {
    const batch = fakeHospitals.slice(i, i + batchSize);
    const batchIds = batch.map(h => h.id);
    
    try {
      // Delete related records first (ambulances, staff, requests)
      await prisma.ambulance.deleteMany({
        where: { hospitalId: { in: batchIds } }
      });
      
      await prisma.user.deleteMany({
        where: { hospitalId: { in: batchIds } }
      });
      
      // Now delete hospitals
      const result = await prisma.hospital.deleteMany({
        where: { 
          id: { in: batchIds }
        }
      });
      
      deleted += result.count;
      console.log(`Deleted batch ${Math.floor(i/batchSize) + 1}: ${result.count} hospitals`);
    } catch (error) {
      console.error(`Failed to delete batch ${Math.floor(i/batchSize) + 1}:`, error.message);
    }
  }
  
  console.log(`\n✅ Cleaned up ${deleted} fake hospitals`);
  
  // Show remaining hospitals
  const remaining = await prisma.hospital.count();
  console.log(`📊 Total hospitals in database now: ${remaining}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
