import { calculateDistance } from "./src/utils/distance.js";
console.log("Test started")

// Example: Bangalore → Delhi
const lat1 = 12.9716;
const lon1 = 77.5946;

const lat2 = 28.7041;
const lon2 = 77.1025;

const distance = calculateDistance(lat1, lon1, lat2, lon2);

console.log("Distance:", distance, "km");