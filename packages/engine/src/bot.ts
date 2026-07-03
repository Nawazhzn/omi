import { rankValue } from "./deck.js";
import { legalCardsFor } from "./engine.js";
import { Card, GameState, Seat, Suit } from "./types.js";

/** Picks the suit of the bot's lowest-ranked card, a common opening heuristic for a blind trump call. */
export function chooseBotTrump(hand: Card[]): Suit {
  let lowest = hand[0];
  for (const c of hand) {
    if (rankValue(c.rank) < rankValue(lowest.rank)) lowest = c;
  }
  return lowest.suit;
}

/**
 * Picks a legal card to play. Simple heuristic: if able to win the trick
 * cheaply, do so with the lowest winning card; otherwise discard the lowest
 * legal card to conserve strength.
 */
export function chooseBotCard(state: GameState, seat: Seat): Card {
  const legal = legalCardsFor(state, seat);
  if (legal.length === 1) return legal[0];

  if (state.currentTrick.length === 0) {
    // Leading: play the lowest card of our longest non-trump suit, or lowest overall.
    return lowestCard(legal);
  }

  const leadSuit = state.currentTrick[0].card.suit;
  const trump = state.trumpSuit;
  const winningSeatCard = currentWinner(state.currentTrick, leadSuit, trump);

  // A teammate already has this trick won — the team gets credit for it
  // regardless of whose card is highest, so there's nothing to gain (and a
  // trump potentially wasted) by trying to improve on our own side's lead.
  const teammateWinning = winningSeatCard.seat % 2 === seat % 2;
  if (teammateWinning) {
    return lowestCard(legal);
  }

  const beatsCurrentWinner = legal.filter((c) => beats(c, winningSeatCard.card, leadSuit, trump));
  if (beatsCurrentWinner.length > 0) {
    return lowestCard(beatsCurrentWinner);
  }
  return lowestCard(legal);
}

function lowestCard(cards: Card[]): Card {
  let lowest = cards[0];
  for (const c of cards) {
    if (rankValue(c.rank) < rankValue(lowest.rank)) lowest = c;
  }
  return lowest;
}

function currentWinner(
  trick: { seat: Seat; card: Card }[],
  leadSuit: Suit,
  trump: Suit | null
): { seat: Seat; card: Card } {
  const trumpPlays = trump ? trick.filter((p) => p.card.suit === trump) : [];
  const pool = trumpPlays.length > 0 ? trumpPlays : trick.filter((p) => p.card.suit === leadSuit);
  let best = pool[0];
  for (const p of pool) {
    if (rankValue(p.card.rank) > rankValue(best.card.rank)) best = p;
  }
  return best;
}

function beats(candidate: Card, current: Card, leadSuit: Suit, trump: Suit | null): boolean {
  const candidateIsTrump = candidate.suit === trump;
  const currentIsTrump = current.suit === trump;
  if (candidateIsTrump && !currentIsTrump) return true;
  if (!candidateIsTrump && currentIsTrump) return false;
  if (candidate.suit !== current.suit) {
    // Neither is trump and they differ in suit: candidate can only beat by
    // following the lead suit when current isn't even in the lead suit
    // (shouldn't normally happen since current is always the best so far).
    return candidate.suit === leadSuit && current.suit !== leadSuit;
  }
  return rankValue(candidate.rank) > rankValue(current.rank);
}
