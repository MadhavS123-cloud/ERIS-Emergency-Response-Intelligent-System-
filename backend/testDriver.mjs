console.log("�� DRIVER FILE STARTED");

import { io } from "socket.io-client";

const socket = io("http://localhost:5001");

socket.on("connect", () => {
  console.log("🚑 Driver connected");

  setInterval(() => {
    const data = {
      lat: 12.9716 + Math.random() * 0.01,
      lng: 77.5946 + Math.random() * 0.01,
    };

    console.log("📡 Sending:", data);

    socket.emit("update_location", data);
  }, 3000);
});

socket.on("connect_error", (err) => {
  console.log("❌ Connection error:", err.message);
});
