import { assignNearestAmbulance } from "./src/services/ambulanceService.js";

async function test() {
  console.log("🚀 Testing ambulance assignment...");

  const ambulance = await assignNearestAmbulance(12.9716, 77.5946);

  console.log("✅ Assigned Ambulance:", ambulance);
}

test().catch((e) => console.error("❌ ERROR:", e));
