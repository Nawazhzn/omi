import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import {
  beginHand,
  callTrump,
  chooseBotCard,
  chooseBotTrump,
  continueTrick,
  createInitialState,
  cutDeck,
  declareDare,
  declareSlam,
  GameState,
  IllegalActionError,
  legalCardsFor,
  nextHand,
  playCard,
  raiseFlag,
  redactStateForSeat,
  respondToDare,
  RuleConfig,
  Seat,
} from "@omi/engine";
import type { ClientToServerEvents, ServerToClientEvents, RoomSnapshot } from "@omi/engine";

const TURN_TIMEOUT_MS = 20_000;
/** Deliberately slow so players can follow each bot action. */
const BOT_MOVE_DELAY_MS = 1_700;
/** Grace period after a trick or a hand before the game auto-advances. */
const ROUND_GRACE_MS = 5_000;
/** How long a disconnected human's seat stays reclaimable (and the room kept
    alive for them) before the room is treated as genuinely abandoned. */
export const RECONNECT_GRACE_MS = 60_000;

export interface SeatInfo {
  seat: Seat;
  socketId: string | null;
  name: string;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  /** Private per-seat secret handed to the occupying client, used to reclaim
      this seat after a refresh or dropped connection. Never broadcast. */
  rejoinToken: string | null;
  /** Timestamp of the last disconnect, used to bound how long a seat stays
      reclaimable. Null while connected or never yet claimed by a human. */
  disconnectedAt: number | null;
}

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;

export class Room {
  readonly id: string;
  readonly joinCode: string;
  /** Optional access-control secret set by the host. Null means anyone with the join code may enter. */
  readonly password: string | null;
  readonly seats: [SeatInfo, SeatInfo, SeatInfo, SeatInfo];
  state: GameState;
  private io: IOServer;
  private turnTimer: NodeJS.Timeout | null = null;
  private botTimer: NodeJS.Timeout | null = null;
  private graceTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(
    id: string,
    joinCode: string,
    io: IOServer,
    hostName: string,
    rules: Partial<RuleConfig>,
    password: string | null = null
  ) {
    this.id = id;
    this.joinCode = joinCode;
    this.password = password;
    this.io = io;
    this.seats = [
      { seat: 0, socketId: null, name: hostName, isBot: false, connected: true, ready: false, rejoinToken: randomUUID(), disconnectedAt: null },
      { seat: 1, socketId: null, name: "Bot East", isBot: true, connected: true, ready: true, rejoinToken: null, disconnectedAt: null },
      { seat: 2, socketId: null, name: "Bot North", isBot: true, connected: true, ready: true, rejoinToken: null, disconnectedAt: null },
      { seat: 3, socketId: null, name: "Bot West", isBot: true, connected: true, ready: true, rejoinToken: null, disconnectedAt: null },
    ];
    this.state = createInitialState(rules, 0);
  }

  /** Constant-time-ish comparison isn't worth it for a short room password in a casual game — a simple equality check is the right tradeoff here. */
  checkPassword(attempt: string | undefined): boolean {
    if (!this.password) return true;
    return attempt === this.password;
  }

  seatBySocket(socketId: string): SeatInfo | undefined {
    return this.seats.find((s) => s.socketId === socketId);
  }

  claimSeatForSocket(socketId: string, name: string): SeatInfo | null {
    const botSeat = this.seats.find((s) => s.isBot);
    if (!botSeat) return null;
    botSeat.socketId = socketId;
    botSeat.name = name;
    botSeat.isBot = false;
    botSeat.connected = true;
    botSeat.ready = false;
    botSeat.rejoinToken = randomUUID();
    botSeat.disconnectedAt = null;
    return botSeat;
  }

  /**
   * Reclaims a specific seat for a new socket connection, provided the caller
   * knows that seat's private rejoin token — issued once, at claim time, and
   * never broadcast. Used after a page refresh or a dropped connection so a
   * returning player gets their own seat back instead of whatever bot slot
   * happens to be open.
   */
  reclaimSeat(socketId: string, seat: Seat, token: string): SeatInfo | null {
    const seatInfo = this.seats[seat];
    if (!seatInfo.rejoinToken || seatInfo.rejoinToken !== token) return null;
    seatInfo.socketId = socketId;
    seatInfo.isBot = false;
    seatInfo.connected = true;
    seatInfo.disconnectedAt = null;
    return seatInfo;
  }

  markReady(socketId: string, ready: boolean) {
    const seat = this.seatBySocket(socketId);
    if (!seat) return;
    seat.ready = ready;
    if (this.allHumansReady() && this.state.phase === "LOBBY") {
      this.state = beginHand(this.state);
      this.afterMutation();
    } else {
      this.broadcast();
    }
  }

  private allHumansReady(): boolean {
    return this.seats.filter((s) => !s.isBot).every((s) => s.ready);
  }

  handleCutDeck(socketId: string, cutPosition?: number) {
    const seat = this.seatBySocket(socketId);
    if (!seat) throw new IllegalActionError("NO_SEAT", "Socket has no seat in this room");
    this.state = cutDeck(this.state, seat.seat, cutPosition);
    this.afterMutation();
  }

  handleCallTrump(socketId: string, suit: Parameters<typeof callTrump>[2]) {
    const seat = this.seatBySocket(socketId);
    if (!seat) throw new IllegalActionError("NO_SEAT", "Socket has no seat in this room");
    this.state = callTrump(this.state, seat.seat, suit);
    this.afterMutation();
  }

  handlePlayCard(socketId: string, card: Parameters<typeof playCard>[2]) {
    const seat = this.seatBySocket(socketId);
    if (!seat) throw new IllegalActionError("NO_SEAT", "Socket has no seat in this room");
    this.state = playCard(this.state, seat.seat, card);
    this.afterMutation();
  }

  handleDeclareSlam(socketId: string) {
    const seat = this.seatBySocket(socketId);
    if (!seat) throw new IllegalActionError("NO_SEAT", "Socket has no seat in this room");
    const team = (seat.seat % 2) as 0 | 1;
    this.state = declareSlam(this.state, team);
    this.afterMutation();
  }

  handleDeclareDare(socketId: string, action: "pass" | "dare" | "allin") {
    const seat = this.seatBySocket(socketId);
    if (!seat) throw new IllegalActionError("NO_SEAT", "Socket has no seat in this room");
    this.state = declareDare(this.state, seat.seat, action);
    this.afterMutation();
  }

  handleRespondToDare(socketId: string, action: "accept" | "safe" | "redare") {
    const seat = this.seatBySocket(socketId);
    if (!seat) throw new IllegalActionError("NO_SEAT", "Socket has no seat in this room");
    this.state = respondToDare(this.state, seat.seat, action);
    this.afterMutation();
  }

  handleRaiseFlag(socketId: string, targetSeat: Seat): boolean {
    const seat = this.seatBySocket(socketId);
    if (!seat) throw new IllegalActionError("NO_SEAT", "Socket has no seat in this room");
    const { state, correct } = raiseFlag(this.state, seat.seat, targetSeat);
    this.state = state;
    this.afterMutation();
    return correct;
  }

  /** Any seated participant can fast-forward the current grace period instead of waiting it out. */
  handleContinue(socketId: string) {
    const seat = this.seatBySocket(socketId);
    if (!seat) return;
    if (this.state.phase !== "TRICK_RESOLVED" && this.state.phase !== "HAND_SCORING") return;
    this.clearTimers();
    this.advancePastGrace();
  }

  handleRematchVote(socketId: string, vote: boolean) {
    if (this.state.phase !== "GAME_OVER" || !vote) return;
    this.state = createInitialState(this.state.rules, 0);
    this.state = beginHand(this.state);
    this.afterMutation();
  }

  /** Called after any state mutation: clears timers, broadcasts, and schedules whatever happens next. */
  private afterMutation() {
    if (this.destroyed) return;
    this.clearTimers();
    this.broadcast();
    if (this.state.phase === "TRICK_RESOLVED" || this.state.phase === "HAND_SCORING") {
      // Hold the result on screen so players can follow what happened, then
      // auto-advance — unless a player continues early via handleContinue.
      this.graceTimer = setTimeout(() => this.advancePastGrace(), ROUND_GRACE_MS);
      return;
    }
    this.scheduleNextActor();
  }

  private advancePastGrace() {
    if (this.state.phase === "TRICK_RESOLVED") {
      this.state = continueTrick(this.state);
    } else if (this.state.phase === "HAND_SCORING") {
      this.state = nextHand(this.state);
    } else {
      return;
    }
    this.afterMutation();
  }

  private activeSeat(): Seat | null {
    if (this.state.phase === "AWAIT_CUT") return this.state.cutSeat;
    if (this.state.phase === "AWAIT_TRUMP_CALL") return this.state.trumpCallerSeat;
    if (this.state.phase === "TRICK_PLAY") return this.state.currentTurnSeat;
    return null;
  }

  /** Omi Dare Mode: which team must act, since either of its seats may respond. Null outside dare phases. */
  private dareActingTeam(): 0 | 1 | null {
    const trumpTeam = (this.state.trumpCallerSeat % 2) as 0 | 1;
    if (this.state.phase === "AWAIT_DARE_CHALLENGE") return trumpTeam === 0 ? 1 : 0;
    if (this.state.phase === "AWAIT_DARE_RESPONSE") return trumpTeam;
    return null;
  }

  /** Defaults: a silent team passes on a challenge, and accepts (at the current level) on a response. */
  private performDareDefault() {
    try {
      const team = this.dareActingTeam();
      if (team === null) return;
      const seat = this.seats.find((s) => (s.seat % 2) === team)!.seat;
      if (this.state.phase === "AWAIT_DARE_CHALLENGE") {
        this.state = declareDare(this.state, seat, "pass");
      } else if (this.state.phase === "AWAIT_DARE_RESPONSE") {
        this.state = respondToDare(this.state, seat, "accept");
      }
      this.afterMutation();
    } catch {
      // Defensive: if the state moved on concurrently, just drop this move.
    }
  }

  private scheduleNextActor() {
    const dareTeam = this.dareActingTeam();
    if (dareTeam !== null) {
      const teamSeats = this.seats.filter((s) => (s.seat % 2) === dareTeam);
      const allBots = teamSeats.every((s) => s.isBot);
      const delay = allBots ? BOT_MOVE_DELAY_MS : this.state.rules.dareTimeoutSeconds * 1000;
      this.turnTimer = setTimeout(() => this.performDareDefault(), delay);
      return;
    }

    const seatIndex = this.activeSeat();
    if (seatIndex === null) return;
    const seat = this.seats[seatIndex];
    if (seat.isBot) {
      this.botTimer = setTimeout(() => this.performBotMove(seatIndex), BOT_MOVE_DELAY_MS);
    } else {
      this.turnTimer = setTimeout(() => this.performAutoMove(seatIndex), TURN_TIMEOUT_MS);
    }
  }

  private performBotMove(seat: Seat) {
    try {
      if (this.state.phase === "AWAIT_CUT") {
        const pos = 8 + Math.floor(Math.random() * 16);
        this.state = cutDeck(this.state, seat, pos);
      } else if (this.state.phase === "AWAIT_TRUMP_CALL") {
        const suit = chooseBotTrump(this.state.hands[seat]);
        this.state = callTrump(this.state, seat, suit);
      } else if (this.state.phase === "TRICK_PLAY") {
        const card = chooseBotCard(this.state, seat);
        this.state = playCard(this.state, seat, card);
      }
      this.afterMutation();
    } catch {
      // Defensive: if the state moved on concurrently, just drop this move.
    }
  }

  /** A human who let the timer run out: same heuristic as a bot, applied on their behalf. */
  private performAutoMove(seat: Seat) {
    this.performBotMove(seat);
  }

  private clearTimers() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    if (this.botTimer) clearTimeout(this.botTimer);
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.turnTimer = null;
    this.botTimer = null;
    this.graceTimer = null;
  }

  /**
   * Stops every pending timer and marks the room dead. MUST be called
   * whenever a room is removed from the server's room registry — otherwise
   * its bot-vs-bot game loop (cut -> trump -> tricks -> next hand -> ...)
   * keeps firing forever via dangling setTimeout closures, leaking memory
   * and CPU for a room nobody is even connected to anymore.
   */
  destroy() {
    this.destroyed = true;
    this.clearTimers();
  }

  broadcast() {
    for (const seat of this.seats) {
      if (!seat.socketId) continue;
      const view = redactStateForSeat(this.state, seat.seat);
      const snapshot: RoomSnapshot = {
        ...view,
        roomId: this.id,
        joinCode: this.joinCode,
        hasPassword: this.password !== null,
        players: this.seats.map((s) => ({
          seat: s.seat,
          name: s.name,
          isBot: s.isBot,
          connected: s.connected,
          ready: s.ready,
        })),
      };
      this.io.to(seat.socketId).emit("state:sync", snapshot);
    }
  }

  legalCardsForSocket(socketId: string) {
    const seat = this.seatBySocket(socketId);
    if (!seat) return [];
    return legalCardsFor(this.state, seat.seat);
  }

  disconnectSocket(socketId: string) {
    const seat = this.seatBySocket(socketId);
    if (!seat) return;
    seat.connected = false;
    seat.disconnectedAt = Date.now();
    // Hand the seat to the bot heuristic immediately so play continues.
    seat.isBot = true;
    // Clear the socket binding so broadcast() stops unicasting state:sync to
    // a socket that explicitly left (or is gone) — otherwise a player who
    // clicks "leave" keeps getting snapped back into the game by the very
    // next bot-driven update, since their socket was still subscribed.
    seat.socketId = null;
    this.broadcast();
    if (this.activeSeat() === seat.seat) {
      this.clearTimers();
      this.scheduleNextActor();
    }
  }

  /** Like disconnectSocket, but also invalidates the rejoin token — used for
      an explicit "Leave game" action, so a stale token can't be used to pop
      back into a seat the player deliberately left. */
  leaveSeat(socketId: string) {
    const seat = this.seatBySocket(socketId);
    if (!seat) return;
    seat.rejoinToken = null;
    this.disconnectSocket(socketId);
  }

  /** Host-only (current occupant of seat 0): ends the game immediately for
      everyone still connected, then marks the room dead. */
  endSession(socketId: string): boolean {
    const seat = this.seatBySocket(socketId);
    if (!seat || seat.seat !== 0) return false;
    this.io.to(this.id).emit("room:ended", { reason: "The host ended this game." });
    this.destroy();
    return true;
  }

  /**
   * A seat still counts as occupied if it's actively connected, OR if it's a
   * disconnected human within the reconnect grace window (a valid
   * rejoinToken plus a recent disconnectedAt). Bot seats have neither and
   * never block emptiness. This must stay grace-window-aware — an earlier
   * version treated any seat without a live socketId as vacated, which
   * destroyed the room the instant the only human's connection dropped,
   * before they ever got a chance to reconnect.
   */
  isEmpty(): boolean {
    const now = Date.now();
    return this.seats.every((s) => {
      if (s.socketId && s.connected) return false;
      if (s.rejoinToken && s.disconnectedAt !== null && now - s.disconnectedAt < RECONNECT_GRACE_MS) return false;
      return true;
    });
  }
}
