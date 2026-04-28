/**
 * Repair script: Assign the nearest available ambulance to any PENDING
 * guest emergency requests that have no ambulance assigned yet.
 *
 * Run with: node fix_stuck_requests.js
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  // Find all stuck PENDING requests with no ambulance
  const stuck = await prisma.request.findMany({
    where: {
      status: 'PENDING',
      ambulanceId: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${stuck.length} stuck PENDING requests.`);

  // Get all available ambulances with their hospital
  const available = await prisma.ambulance.findMany({
    where: { isAvailable: true, driverId: { not: null } },
    include: {
      driver: { select: { id: true, name: true, phone: true } },
      hospital: { select: { id: true, name: true, locationLat: true, locationLng: true } },
    },
  });

  if (available.length === 0) {
    console.log('No available ambulances found. Cannot fix.');
    return;
  }

  for (const req of stuck) {
    const reqLat = req.locationLat;
    const reqLng = req.locationLng;

    if (!reqLat || !reqLng) {
      console.log(`  Request ${req.id.slice(0, 8)} has no location — skipping.`);
      continue;
    }

    // Sort available ambulances by distance to this request
    const sorted = [...available].sort((a, b) => {
      const aLat = a.locationLat ?? a.hospital?.locationLat ?? 0;
      const aLng = a.locationLng ?? a.hospital?.locationLng ?? 0;
      const bLat = b.locationLat ?? b.hospital?.locationLat ?? 0;
      const bLng = b.locationLng ?? b.hospital?.locationLng ?? 0;
      return calculateDistance(reqLat, reqLng, aLat, aLng) - calculateDistance(reqLat, reqLng, bLat, bLng);
    });

    const chosen = sorted[0];
    const hospital = chosen.hospital;

    // Assign the ambulance
    await prisma.ambulance.update({
      where: { id: chosen.id },
      data: { isAvailable: false },
    });

    await prisma.request.update({
      where: { id: req.id },
      data: {
        status: 'ACCEPTED',
        ambulanceId: chosen.id,
        driverId: chosen.driverId,
        mlRecommendedHospitalId: hospital?.id || null,
        mlRecommendedHospitalName: hospital?.name || null,
      },
    });

    // Remove from available pool so same ambulance isn't double-assigned
    const idx = available.findIndex(a => a.id === chosen.id);
    if (idx !== -1) available.splice(idx, 1);

    console.log(`  ✅ Fixed ${req.id.slice(0, 8).toUpperCase()} → Driver: ${chosen.driver?.name}, Hospital: ${hospital?.name}`);
  }

  console.log('\nDone. Reload the patient tracking page to see the updates.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
