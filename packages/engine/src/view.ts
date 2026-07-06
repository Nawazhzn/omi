import { canForfeit, legalCardsFor } from "./engine.js";
import { Card, DareState, GameState, PublicResolvedTrick, PublicTrickPlay, Seat, SEATS, Suit, TrickPlay } from "./types.js";

export interface OpponentSummary {
  seat: Seat;
  cardCount: number;
}

export interface PlayerView {
  phase: GameState["phase"];
  mySeat: Seat;
  myHand: Card[];
  trumpSuit: Suit | null;
  cutSeat: Seat;
  trumpCallerSeat: Seat;
  dealerSeat: Seat;
  currentTurnSeat: Seat | null;
  /** Only present for the seat whose turn it currently is. */
  legalCards: Card[] | null;
  currentTrick: PublicTrickPlay[];
  /** The trick that just resolved, visible during the TRICK_RESOLVED pause. */
  lastTrick: PublicResolvedTrick | null;
  opponents: OpponentSummary[];
  tokens: [number, number];
  pendingBonus: number;
  trickCounts: [number, number];
  /** Tricks won by each seat this hand, for the won-tricks pile next to each player. */
  tricksWonBySeat: [number, number, number, number];
  /** Flag/challenge chances remaining per team for the whole game. */
  flagsRemaining: [number, number];
  /** Omi Dare Mode: this hand's challenge state. */
  dare: DareState;
  /** Virtual coin balance per seat. */
  coins: [number, number, number, number];
  /** Whether each team has already used its one all-in dare for the game. */
  allInUsed: [boolean, boolean];
  /** Consecutive hands each team has won an active dare. */
  dareStreak: [number, number];
  handNumber: number;
  slamDeclaredByTeam: 0 | 1 | null;
  /** Whether THIS seat may currently vote to forfeit (its team holds no trump). */
  canForfeit: boolean;
  /** Per-seat forfeit votes — public, so the UI can show a partner's pending vote. */
  forfeitVotes: [boolean, boolean, boolean, boolean];
  winningTeam: 0 | 1 | null;
  lastHandResult: GameState["lastHandResult"];
  rules: GameState["rules"];
}

function trickCountsByTeam(state: GameState): [number, number] {
  const counts: [number, number] = [0, 0];
  for (const trick of state.trickHistory) {
    counts[trick.winnerSeat % 2]++;
  }
  return counts;
}

function tricksWonBySeat(state: GameState): [number, number, number, number] {
  const counts: [number, number, number, number] = [0, 0, 0, 0];
  for (const trick of state.trickHistory) {
    counts[trick.winnerSeat]++;
  }
  return counts;
}

/**
 * Strips server-only fields (violatesFollowSuit) from a play before it can
 * ever reach a client. A flag challenge is a social judgment call — leaking
 * the answer would defeat the whole point.
 */
function toPublicPlay(play: TrickPlay): PublicTrickPlay {
  return { seat: play.seat, card: play.card };
}

/**
 * Produces the redacted view for exactly one seat. This is the ONLY function
 * permitted to read state.hands. Every other seat's cards are reduced to a
 * count; deckRemainder (undealt cards) and each play's violatesFollowSuit
 * flag are never included at all.
 */
export function redactStateForSeat(state: GameState, seat: Seat): PlayerView {
  const opponents: OpponentSummary[] = SEATS.filter((s) => s !== seat).map((s) => ({
    seat: s,
    cardCount: state.hands[s].length,
  }));

  const isMyTurn = state.currentTurnSeat === seat && state.phase === "TRICK_PLAY";

  const lastTrick: PublicResolvedTrick | null = state.lastTrick
    ? {
        index: state.lastTrick.index,
        leadSuit: state.lastTrick.leadSuit,
        winnerSeat: state.lastTrick.winnerSeat,
        plays: state.lastTrick.plays.map(toPublicPlay),
      }
    : null;

  return {
    phase: state.phase,
    mySeat: seat,
    myHand: [...state.hands[seat]],
    trumpSuit: state.trumpSuit,
    cutSeat: state.cutSeat,
    trumpCallerSeat: state.trumpCallerSeat,
    dealerSeat: state.dealerSeat,
    currentTurnSeat: state.currentTurnSeat,
    legalCards: isMyTurn ? legalCardsFor(state, seat) : null,
    currentTrick: state.currentTrick.map(toPublicPlay),
    lastTrick,
    opponents,
    tokens: state.tokens,
    pendingBonus: state.pendingBonus,
    trickCounts: trickCountsByTeam(state),
    tricksWonBySeat: tricksWonBySeat(state),
    flagsRemaining: state.flagsRemaining,
    dare: state.dare,
    coins: state.coins,
    allInUsed: state.allInUsed,
    dareStreak: state.dareStreak,
    handNumber: state.handNumber,
    slamDeclaredByTeam: state.slamDeclaredByTeam,
    canForfeit: canForfeit(state, seat),
    forfeitVotes: state.forfeitVotes,
    winningTeam: state.winningTeam,
    lastHandResult: state.lastHandResult,
    rules: state.rules,
  };
}

export function redactStateForAllSeats(state: GameState): Record<Seat, PlayerView> {
  return {
    0: redactStateForSeat(state, 0),
    1: redactStateForSeat(state, 1),
    2: redactStateForSeat(state, 2),
    3: redactStateForSeat(state, 3),
  };
}
