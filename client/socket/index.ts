// client/sockets/index.ts
import { io, Socket } from "socket.io-client";

import { API_URL } from "@/constants";

let socket: Socket | null = null;

export function ensureSocket(token: string, baseUrl?: string) {
  if (socket) return socket;
  const socketUrl = baseUrl || API_URL;
  socket = io(socketUrl, {
    transports: ["websocket"],
    auth: { token }, // 👈 your JWT
  });
  return socket;
}

export function getSocket() {
  if (!socket) throw new Error("Socket not initialized. Call ensureSocket() first.");
  return socket;
}
