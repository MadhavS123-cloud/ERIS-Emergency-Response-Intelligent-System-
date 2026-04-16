import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Fetching hospitals (Overpass API)...");

  // Fetch hospitals around Bangalore/Whitefield (40km radius)
  const query = `
    [out:json][timeout:60];
    (
      node["amenity"~"hospital|clinic"](around:50000, 12.9785, 77.7262);
      way["amenity"~"hospital|clinic"](around:50000, 12.9785, 77.7262);
    );
    out center;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  const data = await res.json();
  const elements = data.elements || [];

  console.log("📦 Total facilities found:", elements.length);

  let count = 0;

  for (const h of elements) {
    const name = h.tags?.name || h.tags?.['name:en'];
    if (name) {
      const lat = h.lat || h.center?.lat;
      const lon = h.lon || h.center?.lon;

      if (lat && lon) {
        let existing = await prisma.hospital.findFirst({
            where: { name: name }
        });
        
        if (!existing) {
            try {
                const icu = Math.floor(Math.random() * 20);
                const gen = Math.floor(Math.random() * 50) + 10;
                
                const newHospital = await prisma.hospital.create({
                  data: {
                    name: name,
                    address: h.tags["addr:full"] || h.tags["addr:street"] || `${name}, Bangalore`,
                    locationLat: parseFloat(lat),
                    locationLng: parseFloat(lon),
                    icuBedsAvailable: icu,
                    generalBedsAvailable: gen,
                    bedCapacity: icu + gen,
                    ventilatorsAvailable: Math.floor(Math.random() * 10)
                  }
                });
                
                // Add an ambulance to satisfy the business logic
                const driver = await prisma.user.create({
                  data: {
                    name: `${name} Driver`,
                    email: `driver_${Date.now()}_${count}@eris.com`,
                    password: 'password123',
                    role: 'DRIVER'
                  }
                });
                
                await prisma.ambulance.create({
                  data: {
                    driverId: driver.id,
                    hospitalId: newHospital.id,
                    plateNumber: `KA-0${Math.floor(Math.random() * 9) + 1}-${Math.floor(Math.random() * 8999) + 1000}`,
                    locationLat: parseFloat(lat),
                    locationLng: parseFloat(lon),
                    isAvailable: true
                  }
                });

                count++;
            } catch (err) {
                // Ignore duplicates or missing fields
            }
        }
      }
    }
  }

  console.log(`✅ Inserted ${count} new hospitals and their ambulances`);
}

main()
  .catch((e) => console.error("❌ ERROR:", e))
  .finally(() => prisma.$disconnect());