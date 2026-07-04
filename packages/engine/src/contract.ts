import { Card, RuleConfig, Seat, Suit, Team } from "./types.js";
import { PlayerView } from "./view.js";

export interface PublicPlayerInfo {
  seat: Seat;
  name: string;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
}

export interface RoomSnapshot extends PlayerView {
  roomId: string;
  joinCode: string;
  /** Whether the host set a password on this room — never the password itself. */
  hasPassword: boolean;
  players: PublicPlayerInfo[];
}

export interface ClientToServerEvents {
  /**
   * `password`, if set, gates room:join — knowing the join code alone is no longer enough.
   * `playerId` is a stable private per-browser id: when a returning player joins the same
   * room again (new tab, dropped connection, etc.) the server hands back their original
   * seat instead of seating them twice. Never broadcast to other players.
   */
  "room:create": (
    payload: { name: string; rules?: Partial<RuleConfig>; password?: string; playerId?: string },
    ack: (
      res: { ok: true; roomId: string; joinCode: string; seat: Seat; rejoinToken: string } | { ok: false; error: string }
    ) => void
  ) => void;
  "room:join": (
    payload: { joinCode: string; name: string; password?: string; playerId?: string },
    ack: (res: { ok: true; roomId: string; seat: Seat; rejoinToken: string } | { ok: false; error: string }) => void
  ) => void;
  /** Reclaims a seat after a page refresh or dropped connection, using the private token issued at room:create/room:join — never broadcast to other players. */
  "room:rejoin": (
    payload: { roomId: string; seat: Seat; rejoinToken: string },
    ack: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  "room:leave": (payload: Record<string, never>) => void;
  /** Host-only (current occupant of seat 0): ends the game immediately for everyone in the room. */
  "room:end": (payload: Record<string, never>, ack: (res: { ok: true } | { ok: false; error: string }) => void) => void;
  "seat:ready": (payload: { ready: boolean }) => void;
  "game:cutDeck": (payload: { cutPosition?: number }, ack: (res: { ok: boolean; error?: string }) => void) => void;
  "game:callTrump": (payload: { suit: Suit }, ack: (res: { ok: boolean; error?: string }) => void) => void;
  "game:playCard": (payload: { card: Card }, ack: (res: { ok: boolean; error?: string }) => void) => void;
  "game:declareSlam": (payload: Record<string, never>, ack: (res: { ok: boolean; error?: string }) => void) => void;
  /** Challenges a specific seat's play in the current/just-resolved trick as a follow-suit violation. */
  "game:raiseFlag": (
    payload: { targetSeat: Seat },
    ack: (res: { ok: true; correct: boolean } | { ok: false; error: string }) => void
  ) => void;
  /** Omi Dare Mode: the opposing team's response to a freshly-called trump. */
  "game:declareDare": (
    payload: { action: "pass" | "dare" | "allin" },
    ack: (res: { ok: boolean; error?: string }) => void
  ) => void;
  /** Omi Dare Mode: the trump team's response to an open dare. */
  "game:respondToDare": (
    payload: { action: "accept" | "safe" | "redare" },
    ack: (res: { ok: boolean; error?: string }) => void
  ) => void;
  /** Fast-forwards the current grace period (after a trick or a hand) instead of waiting out the full pause. */
  "game:continue": (payload: Record<string, never>) => void;
  "game:rematchVote": (payload: { vote: boolean }) => void;
}

export interface ServerToClientEvents {
  "state:sync": (view: RoomSnapshot) => void;
  /** Sent to every remaining player when the host ends the session early. */
  "room:ended": (payload: { reason: string }) => void;
  "game:trumpCalled": (payload: { suit: Suit; bySeat: Seat }) => void;
  "game:cardPlayed": (payload: { seat: Seat; card: Card }) => void;
  "game:trickWon": (payload: { seat: Seat; trickIndex: number }) => void;
  "game:handScored": (payload: RoomSnapshot["lastHandResult"]) => void;
  "game:over": (payload: { winningTeam: Team }) => void;
  error: (payload: { code: string; message: string }) => void;
}
