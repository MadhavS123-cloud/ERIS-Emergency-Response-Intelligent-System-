import { PrismaClient } from "@prisma/client";
console.log("🚀 Seeding drivers + ambulances...");
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Seeding ambulances...");

  await prisma.ambulance.createMany({
    data: [
      {
        driverId: "driver1",
        plateNumber: "KA01AB1234",
        locationLat: 12.9716,
        locationLng: 77.5946,
        isAvailable: true
      },
      {
        driverId: "driver2",
        plateNumber: "KA02CD5678",
        locationLat: 12.9352,
        locationLng: 77.6245,
        isAvailable: true
      },
      {
        driverId: "driver3",
        plateNumber: "KA03EF9012",
        locationLat: 13.0827,
        locationLng: 80.2707,
        isAvailable: true
      }
    ]
  });

  console.log("✅ Ambulances added");
}

main().finally(() => prisma.$disconnect());