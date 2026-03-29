import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'test@eris.com' },
    update: {},
    create: {
      email: 'test@eris.com',
      name: 'Test Patient',
      password: hashedPassword,
      role: 'PATIENT',
      phone: '1234567890'
    },
  });

  console.log('Test user created:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
