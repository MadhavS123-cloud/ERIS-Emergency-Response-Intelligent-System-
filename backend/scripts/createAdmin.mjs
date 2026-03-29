import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Creating admin...");
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@eris.com" },
    update: {
      name: "System Admin",
      password: hashedPassword,
      role: "ADMIN"
    },
    create: {
      name: "System Admin",
      email: "admin@eris.com",
      password: hashedPassword,
      role: "ADMIN"
    }
  });

  console.log("✅ Admin created:", admin.id);
}

main()
  .catch((e) => {
    console.error("❌ ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
