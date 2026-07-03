import { rankValue, SUITS, type Card } from "@omi/engine";

/** Display-only ordering — groups by suit (♠♥♦♣), highest rank first within
    each suit. Never affects engine state, only how a hand is rendered. */
export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return rankValue(b.rank) - rankValue(a.rank);
  });
}
