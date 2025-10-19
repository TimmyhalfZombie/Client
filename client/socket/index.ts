// client/sockets/index.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function ensureSocket(token: string, baseUrl?: string) {
  if (socket) return socket;
  const API_URL = baseUrl || process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
  socket = io(API_URL, {
    transports: ["websocket"],
    auth: { token }, // 👈 your JWT
  });
  return socket;
}

export function getSocket() {
  if (!socket) throw new Error("Socket not initialized. Call ensureSocket() first.");
  return socket;
}
