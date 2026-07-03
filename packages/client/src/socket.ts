import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@omi/engine";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: false,
});

// Dev-only escape hatch for inspecting raw wire traffic (e.g. confirming no
// hidden-hand data ever reaches the client). Stripped from production builds
// since import.meta.env.DEV is statically replaced with `false`.
if (import.meta.env.DEV) {
  (window as unknown as { __omiSocket: typeof socket; __omiIo: typeof io; __omiServerUrl: string }).__omiSocket = socket;
  (window as unknown as { __omiIo: typeof io }).__omiIo = io;
  (window as unknown as { __omiServerUrl: string }).__omiServerUrl = SERVER_URL;
}
