import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const URL =
  "https://nominatim.openstreetmap.org/search?q=hospital+bangalore&format=json&limit=50";

async function main() {
  console.log("🚀 Fetching hospitals (Nominatim)...");

  const res = await fetch(URL, {
    headers: {
      "User-Agent": "eris-app"
    }
  });

  const data = await res.json();

  console.log("📦 Total hospitals:", data.length);

  let count = 0;

  for (const h of data) {
    if (h.display_name && h.lat && h.lon) {
      console.log("➡️ Adding:", h.display_name);

      await prisma.hospital.create({
        data: {
          name: h.display_name,
          address: h.display_name,
          locationLat: parseFloat(h.lat),
          locationLng: parseFloat(h.lon)
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