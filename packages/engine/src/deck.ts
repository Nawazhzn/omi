import { Card, RANKS, SUITS } from "./types.js";
import { secureRandomInt } from "./rng.js";

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Cryptographically secure Fisher-Yates shuffle. Never shuffle client-side. */
export function shuffle(deck: Card[]): Card[] {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

const RANK_VALUE: Record<string, number> = {
  A: 8,
  K: 7,
  Q: 6,
  J: 5,
  "10": 4,
  "9": 3,
  "8": 2,
  "7": 1,
};

export function rankValue(rank: Card["rank"]): number {
  return RANK_VALUE[rank];
}
