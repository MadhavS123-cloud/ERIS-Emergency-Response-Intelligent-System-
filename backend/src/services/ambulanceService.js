import { PrismaClient } from "@prisma/client";
import { calculateDistance } from "../utils/distance.js";

const prisma = new PrismaClient();

export async function assignNearestAmbulance(pickupLat, pickupLng) {
  console.log("🚀 Finding nearest ambulance...");

  const ambulances = await prisma.ambulance.findMany({
    where: {
      isAvailable: true
    }
  });

  if (ambulances.length === 0) {
    throw new Error("No ambulances available");
  }

  let nearestAmbulance = null;
  let minDistance = Infinity;

  for (const amb of ambulances) {
    if (!amb.locationLat || !amb.locationLng) continue;

    const distance = calculateDistance(
      pickupLat,
      pickupLng,
      amb.locationLat,
      amb.locationLng
    );

    console.log(`Ambulance ${amb.id} → ${distance.toFixed(2)} km`);

    if (distance < minDistance) {
      minDistance = distance;
      nearestAmbulance = amb;
    }
  }

  if (!nearestAmbulance) {
    throw new Error("No valid ambulance found");
  }

  console.log("✅ Nearest ambulance:", nearestAmbulance.id);

  return nearestAmbulance;
}
