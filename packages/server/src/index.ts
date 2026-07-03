import { createServer } from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@omi/engine";
import { IllegalActionError } from "@omi/engine";
import { RECONNECT_GRACE_MS, Room } from "./room.js";

const PORT = Number(process.env.PORT ?? 4000);
const MAX_NAME_LENGTH = 24;
const MAX_PASSWORD_LENGTH = 32;

// CORS: accept a comma-separated list so a single env var can cover staging +
// production frontends. Defaults to localhost for local dev — which is safe
// (it simply rejects real browsers) but should never be left unset in prod.
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production" && !process.env.CLIENT_ORIGIN) {
  console.warn(
    "[omi] WARNING: running with NODE_ENV=production but CLIENT_ORIGIN is unset — " +
      "defaulting to http://localhost:5173, which will reject every real browser. " +
      "Set CLIENT_ORIGIN to your deployed frontend's origin(s)."
  );
}

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGINS },
});

const rooms = new Map<string, Room>();
const joinCodes = new Map<string, string>(); // joinCode -> roomId

/**
 * Join codes gate access to a private room, so they're generated with a CSPRNG
 * (not Math.random(), which is not designed to resist prediction) — the same
 * standard already applied to deck shuffling.
 */
function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join("");
  } while (joinCodes.has(code));
  return code;
}

function sanitizeName(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || "Player";
}

/** Empty/whitespace-only input means "no password", not a literal empty-string password. */
function sanitizePassword(raw: string | undefined): string | null {
  const trimmed = (raw ?? "").trim().slice(0, MAX_PASSWORD_LENGTH);
  return trimmed || null;
}

/** Tears down a room's timers and registry entries once nobody is connected to it. */
function cleanupIfEmpty(room: Room | undefined) {
  if (!room || !room.isEmpty()) return;
  room.destroy();
  rooms.delete(room.id);
  joinCodes.delete(room.joinCode);
}

/**
 * A minimal in-process sliding-window rate limiter, keyed by client IP. This
 * is a baseline safeguard against a single careless or malicious client
 * spamming room creation or brute-forcing join codes/passwords — it is NOT a
 * substitute for rate limiting at the reverse-proxy/infra layer, which
 * should still be used in production to cover distributed abuse.
 */
class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** Records an attempt and returns whether it's allowed under the limit. */
  attempt(key: string): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

const createLimiter = new RateLimiter(8, 10 * 60 * 1000); // 8 rooms per 10 min per IP
const joinLimiter = new RateLimiter(20, 5 * 60 * 1000); // 20 join attempts per 5 min per IP — slows code/password guessing

function clientIp(socket: { handshake: { address: string } }): string {
  return socket.handshake.address;
}

io.on("connection", (socket) => {
  let currentRoomId: string | null = null;

  socket.on("room:create", ({ name, rules, password }, ack) => {
    if (!createLimiter.attempt(clientIp(socket))) {
      ack({ ok: false, error: "Too many rooms created recently — please wait a few minutes and try again" });
      return;
    }
    const safeName = sanitizeName(name);
    const roomId = randomUUID();
    const joinCode = generateJoinCode();
    const room = new Room(roomId, joinCode, io, safeName, rules ?? {}, sanitizePassword(password));
    const seat = room.seats[0];
    seat.socketId = socket.id;
    seat.name = safeName;
    seat.isBot = false;
    seat.connected = true;

    rooms.set(roomId, room);
    joinCodes.set(joinCode, roomId);
    currentRoomId = roomId;
    socket.join(roomId);
    ack({ ok: true, roomId, joinCode, seat: seat.seat, rejoinToken: seat.rejoinToken! });
    room.broadcast();
  });

  socket.on("room:join", ({ joinCode, name, password }, ack) => {
    if (!joinLimiter.attempt(clientIp(socket))) {
      ack({ ok: false, error: "Too many attempts — please wait a few minutes and try again" });
      return;
    }
    const roomId = joinCodes.get(joinCode.toUpperCase());
    const room = roomId ? rooms.get(roomId) : undefined;
    if (!room) {
      ack({ ok: false, error: "Room not found" });
      return;
    }
    if (!room.checkPassword(password)) {
      ack({ ok: false, error: "Incorrect password" });
      return;
    }
    const seat = room.claimSeatForSocket(socket.id, sanitizeName(name));
    if (!seat) {
      ack({ ok: false, error: "Room is full" });
      return;
    }
    currentRoomId = room.id;
    socket.join(room.id);
    ack({ ok: true, roomId: room.id, seat: seat.seat, rejoinToken: seat.rejoinToken! });
    room.broadcast();
  });

  socket.on("room:rejoin", ({ roomId, seat, rejoinToken }, ack) => {
    if (!joinLimiter.attempt(clientIp(socket))) {
      ack({ ok: false, error: "Too many attempts — please wait a few minutes and try again" });
      return;
    }
    const room = rooms.get(roomId);
    if (!room) {
      ack({ ok: false, error: "Room no longer exists" });
      return;
    }
    const seatInfo = room.reclaimSeat(socket.id, seat, rejoinToken);
    if (!seatInfo) {
      ack({ ok: false, error: "Could not reclaim that seat" });
      return;
    }
    currentRoomId = room.id;
    socket.join(room.id);
    ack({ ok: true });
    room.broadcast();
  });

  socket.on("room:leave", () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    room?.leaveSeat(socket.id);
    socket.leave(currentRoomId);
    cleanupIfEmpty(room);
    currentRoomId = null;
  });

  socket.on("seat:ready", ({ ready }) => {
    if (!currentRoomId) return;
    rooms.get(currentRoomId)?.markReady(socket.id, ready);
  });

  socket.on("game:cutDeck", ({ cutPosition }, ack) => {
    if (!currentRoomId) return ack({ ok: false, error: "Not in a room" });
    try {
      rooms.get(currentRoomId)?.handleCutDeck(socket.id, cutPosition);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("game:callTrump", ({ suit }, ack) => {
    if (!currentRoomId) return ack({ ok: false, error: "Not in a room" });
    try {
      rooms.get(currentRoomId)?.handleCallTrump(socket.id, suit);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("game:playCard", ({ card }, ack) => {
    if (!currentRoomId) return ack({ ok: false, error: "Not in a room" });
    try {
      rooms.get(currentRoomId)?.handlePlayCard(socket.id, card);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("game:declareSlam", (_payload, ack) => {
    if (!currentRoomId) return ack({ ok: false, error: "Not in a room" });
    try {
      rooms.get(currentRoomId)?.handleDeclareSlam(socket.id);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("game:declareDare", ({ action }, ack) => {
    const room = currentRoomId ? rooms.get(currentRoomId) : undefined;
    if (!room) return ack({ ok: false, error: "Not in a room" });
    try {
      room.handleDeclareDare(socket.id, action);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("game:respondToDare", ({ action }, ack) => {
    const room = currentRoomId ? rooms.get(currentRoomId) : undefined;
    if (!room) return ack({ ok: false, error: "Not in a room" });
    try {
      room.handleRespondToDare(socket.id, action);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("game:raiseFlag", ({ targetSeat }, ack) => {
    const room = currentRoomId ? rooms.get(currentRoomId) : undefined;
    if (!room) return ack({ ok: false, error: "Not in a room" });
    try {
      const correct = room.handleRaiseFlag(socket.id, targetSeat);
      ack({ ok: true, correct });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("game:continue", () => {
    if (!currentRoomId) return;
    rooms.get(currentRoomId)?.handleContinue(socket.id);
  });

  socket.on("game:rematchVote", ({ vote }) => {
    if (!currentRoomId) return;
    rooms.get(currentRoomId)?.handleRematchVote(socket.id, vote);
  });

  socket.on("disconnect", () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    room?.disconnectSocket(socket.id);
    // isEmpty() honors the reconnect grace window, so this is a no-op right
    // after a fresh disconnect — the delayed re-check below is what actually
    // tears down a room nobody ever came back to.
    cleanupIfEmpty(room);
    if (room) setTimeout(() => cleanupIfEmpty(room), RECONNECT_GRACE_MS + 1_000);
  });
});

function errorMessage(err: unknown): string {
  if (err instanceof IllegalActionError) return err.message;
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

httpServer.listen(PORT, () => {
  console.log(`Omi server listening on :${PORT}`);
});
