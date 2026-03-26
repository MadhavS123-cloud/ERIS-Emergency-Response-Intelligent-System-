import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Creating admin...");

  const admin = await prisma.user.upsert({
    where: { email: "admin@eris.com" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@eris.com",
      password: "admin123",
      role: "ADMIN"
    }
  });

  console.log("✅ Admin created:", admin.id);
}

main()
  .catch((e) => console.error("❌ ERROR:", e))
  .finally(() => prisma.$disconnect());
