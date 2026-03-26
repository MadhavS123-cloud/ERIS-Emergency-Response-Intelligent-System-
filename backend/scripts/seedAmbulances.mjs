import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Seeding drivers + ambulances...");

  const driver1 = await prisma.user.create({
    data: {
      name: "Driver 1",
      email: "driver1@test.com",
      password: "123",
      role: "DRIVER"
    }
  });

  const driver2 = await prisma.user.create({
    data: {
      name: "Driver 2",
      email: "driver2@test.com",
      password: "123",
      role: "DRIVER"
    }
  });

  await prisma.ambulance.createMany({
    data: [
      {
        driverId: driver1.id,
        plateNumber: "KA01AB1234",
        locationLat: 12.9716,
        locationLng: 77.5946,
        isAvailable: true
      },
      {
        driverId: driver2.id,
        plateNumber: "KA02CD5678",
        locationLat: 12.9352,
        locationLng: 77.6245,
        isAvailable: true
      }
    ]
  });

  console.log("✅ Seeding complete");
}

main()
  .catch((e) => console.error("❌ ERROR:", e))
  .finally(() => prisma.$disconnect());
