export type Suit = "S" | "H" | "D" | "C";
export const SUITS: Suit[] = ["S", "H", "D", "C"];

export type Rank = "A" | "K" | "Q" | "J" | "10" | "9" | "8" | "7";
export const RANKS: Rank[] = ["A", "K", "Q", "J", "10", "9", "8", "7"];

export interface Card {
  suit: Suit;
  rank: Rank;
}

export function cardId(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Seats 0-3, counter-clockwise turn order: 0 -> 3 -> 2 -> 1 -> 0. Teams: {0,2} vs {1,3}. */
export type Seat = 0 | 1 | 2 | 3;
export const SEATS: Seat[] = [0, 1, 2, 3];

/** Team 0 = seats {0,2}, Team 1 = seats {1,3}. */
export type Team = 0 | 1;

export function teamOfSeat(seat: Seat): Team {
  return (seat % 2) as Team;
}

/** Next seat in counter-clockwise turn order — also the dealer's right. */
export function nextSeat(seat: Seat): Seat {
  return ((seat + 3) % 4) as Seat;
}

/** Previous seat in counter-clockwise turn order — also the dealer's left. */
export function prevSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

export type Phase =
  | "LOBBY"
  | "AWAIT_CUT"
  | "DEALING_BATCH_1"
  | "AWAIT_TRUMP_CALL"
  | "AWAIT_DARE_CHALLENGE"
  | "AWAIT_DARE_RESPONSE"
  | "DEALING_BATCH_2"
  | "TRICK_PLAY"
  | "TRICK_RESOLVED"
  | "HAND_SCORING"
  | "GAME_OVER";

/** Omi Dare Mode: how far the pre-deal challenge has escalated this hand. */
export type DareLevel = "none" | "dare" | "redare" | "allin";

export const DARE_MULTIPLIER: Record<DareLevel, number> = {
  none: 1,
  dare: 2,
  redare: 4,
  allin: 6,
};

export interface DareState {
  level: DareLevel;
  /** The team that issued the challenge (always the non-trump-calling team). Null when level is "none". */
  challengerTeam: Team | null;
}

export interface TrickPlay {
  seat: Seat;
  card: Card;
  /**
   * Server-only: true when this play did not follow the led suit even
   * though the player held a card of that suit — a flaggable violation.
   * Never expose this to clients; it would give away the answer to a
   * challenge that's supposed to be a social judgment call.
   */
  violatesFollowSuit: boolean;
}

/** The subset of a TrickPlay safe to show clients — never includes violatesFollowSuit. */
export interface PublicTrickPlay {
  seat: Seat;
  card: Card;
}

export interface ResolvedTrick {
  index: number;
  plays: TrickPlay[];
  leadSuit: Suit;
  winnerSeat: Seat;
}

export interface PublicResolvedTrick {
  index: number;
  plays: PublicTrickPlay[];
  leadSuit: Suit;
  winnerSeat: Seat;
}

export interface RuleConfig {
  /** Tokens a team must reach to win the game. */
  targetTokens: number;
  /** Hard cap on hands played; the game ends after this many rounds even if
      no team has hit targetTokens (winner = more tokens, tie = draw). 0 = no cap. */
  maxRounds: number;
  slamHouseRule: boolean;
  /** When true, illegal (non-following) plays are blocked outright instead of being left to flag challenges. */
  strictFollowSuit: boolean;
  /** Flag/challenge chances available to each team for the whole game. */
  flagsPerTeam: number;
  /** Omi Dare Mode: a fun virtual-coin side bet on the hand outcome, layered on top of normal scoring. */
  dareMode: boolean;
  /** Virtual coins each player stakes per dare level (multiplied by the dare's level). */
  dareBaseStake: number;
  /** Seconds each side gets to act before the dare auto-resolves to its default. */
  dareTimeoutSeconds: number;
}

export const DEFAULT_RULES: RuleConfig = {
  targetTokens: 10,
  maxRounds: 0,
  slamHouseRule: false,
  strictFollowSuit: false,
  flagsPerTeam: 3,
  dareMode: false,
  dareBaseStake: 10,
  dareTimeoutSeconds: 10,
};

export interface FlagResult {
  raisedByTeam: Team;
  offendingSeat: Seat;
  offendingTeam: Team;
}

export interface DareResult {
  level: DareLevel;
  multiplier: number;
  challengerTeam: Team;
  /** Null when the dare was cancelled (4-4 draw) and fully refunded. */
  winnerTeam: Team | null;
  cancelled: boolean;
  /** Per-seat coin change from this hand's dare outcome (already applied to GameState.coins). */
  coinsDelta: [number, number, number, number];
  kapothiBonusApplied: boolean;
  streakBonusApplied: boolean;
  comebackBonusApplied: boolean;
  /** The winning team's dare-win streak after this hand. */
  streakAfter: number;
}

export interface HandResult {
  trickCounts: [number, number]; // by team
  tokensAwarded: [number, number];
  kapothi: boolean;
  kapothiTeam: Team | null;
  pendingBonusApplied: number;
  pendingBonusAfter: number;
  slamFailedTeam: Team | null;
  /** Set when this hand ended early because of a confirmed flag, instead of normal trick scoring. */
  flag: FlagResult | null;
  /** Set when Dare Mode was active and a challenge was actually issued this hand. */
  dare: DareResult | null;
}

export interface GameState {
  phase: Phase;
  rules: RuleConfig;

  handNumber: number;
  dealerSeat: Seat;
  /** The seat to the dealer's left: cuts the deck before any cards are dealt. */
  cutSeat: Seat;
  trumpCallerSeat: Seat;
  trumpSuit: Suit | null;

  /** Full hands, server-only. Index by seat. */
  hands: [Card[], Card[], Card[], Card[]];

  currentTurnSeat: Seat | null;
  currentTrick: TrickPlay[];
  trickHistory: ResolvedTrick[];
  /** The trick that just resolved, kept visible during the TRICK_RESOLVED pause. */
  lastTrick: ResolvedTrick | null;

  /** Tokens per team, persists across hands within a game. */
  tokens: [number, number];
  pendingBonus: number;

  /** Flag/challenge chances remaining per team, persists across hands within a game. */
  flagsRemaining: [number, number];

  /** This hand's dare challenge, reset to "none" at the start of every hand. */
  dare: DareState;
  /** Virtual coin balance per seat, persists across hands within a game. */
  coins: [number, number, number, number];
  /** Whether each team has already used its one all-in dare for the game. */
  allInUsed: [boolean, boolean];
  /** Consecutive hands each team has won an active dare, persists across hands within a game. */
  dareStreak: [number, number];

  slamDeclaredByTeam: Team | null;

  winningTeam: Team | null;
  lastHandResult: HandResult | null;

  /**
   * Server-internal: cards not yet dealt this hand — the full 32-card deck
   * while AWAIT_CUT, then the 16 left over between batch 1 and batch 2.
   * Contains future card identities for all seats — must NEVER be sent to
   * any client. Absent once batch 2 has been dealt.
   */
  deckRemainder?: Card[];
}
