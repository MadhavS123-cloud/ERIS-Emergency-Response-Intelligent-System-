import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

export const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ["websocket"],
});
