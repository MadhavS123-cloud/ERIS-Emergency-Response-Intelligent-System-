import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findHospitalUser() {
  try {
    const hospital = await prisma.hospital.findFirst({
      where: {
        name: 'Lakeside Multispeciality Hospital'
      },
      include: {
        staff: true
      }
    });

    if (hospital) {
      console.log('Hospital Details:', hospital);
      if (hospital.staff && hospital.staff.length > 0) {
        console.log('\nStaff (Usernames/Emails):');
        hospital.staff.forEach(user => {
          console.log(`- Name: ${user.name}, Email/Username: ${user.email}, Role: ${user.role}`);
        });
      } else {
        console.log('\nNo staff linked to this hospital.');
      }
    } else {
      console.log('Hospital not found.');
    }
  } catch (error) {
    console.error('Error finding hospital user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findHospitalUser();
