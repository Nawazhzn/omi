import type { Card, Suit } from "@omi/engine";
import { sortHand } from "../sortHand.js";
import { CardFace, SUIT_SYMBOLS } from "./Card.js";

const SUITS: Suit[] = ["S", "H", "D", "C"];
const SUIT_STYLE: Record<Suit, string> = {
  S: "from-felt-800 to-felt-950 text-ink",
  C: "from-felt-800 to-felt-950 text-ink",
  H: "from-ruby-500 to-ruby-700 text-white",
  D: "from-ruby-500 to-ruby-700 text-white",
};

export function TrumpModal({ cards, onChoose }: { cards: Card[]; onChoose: (suit: Suit) => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="ring-foil bg-felt-800/95 rounded-[1.75rem] p-8 shadow-2xl text-center w-full max-w-[26rem]">
        <div className="text-gold-300 text-xs font-medium uppercase tracking-widest mb-3">Your call</div>
        <h2 className="font-display text-ink text-3xl font-semibold mb-1">Choose trumps</h2>
        <p className="text-ink-dim/75 text-sm mb-5">
          Your first 4 cards — pick the suit that suits you best.
        </p>

        {/* Player's current hand */}
        <div className="flex justify-center gap-3 mb-6">
          {sortHand(cards).map((card) => (
            <CardFace key={`${card.rank}${card.suit}`} card={card} size="md" />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SUITS.map((suit) => (
            <button
              key={suit}
              onClick={() => onChoose(suit)}
              className={[
                "bg-gradient-to-br rounded-2xl py-6 text-4xl font-black shadow-md ring-1 ring-inset ring-gold-400/20",
                "hover:scale-[1.03] hover:shadow-lg active:scale-95 transition-all duration-150 ease-out",
                SUIT_STYLE[suit],
              ].join(" ")}
            >
              {SUIT_SYMBOLS[suit]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
