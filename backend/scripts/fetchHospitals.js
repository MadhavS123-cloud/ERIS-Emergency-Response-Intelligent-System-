import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const URL = "https://overpass-api.de/api/interpreter?data=[out:json];(node[\"amenity\"=\"hospital\"](12.8,77.4,13.2,77.8);way[\"amenity\"=\"hospital\"](12.8,77.4,13.2,77.8););out center;";

async function main() {
  console.log("🚀 Fetching hospitals...");

  const res = await fetch(URL);
  const data = await res.json();

  console.log("📦 Total elements:", data.elements.length);

  let count = 0;

  for (const el of data.elements) {
    const lat = el.lat || el.center?.lat;
    const lon = el.lon || el.center?.lon;

    if (el.tags?.name && lat && lon) {
      console.log("➡️ Adding:", el.tags.name);

      await prisma.hospital.create({
        data: {
          name: el.tags.name,
          latitude: lat,
          longitude: lon
        }
      });

      count++;
    }
  }

  console.log(`✅ Inserted ${count} hospitals`);
}

main()
  .catch((e) => console.error("❌ ERROR:", e))
  .finally(() => prisma.$disconnect());