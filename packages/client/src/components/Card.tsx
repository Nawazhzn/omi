import type { Card as CardType, Rank, Suit } from "@omi/engine";

const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_NAME: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
const RED_SUITS = new Set<Suit>(["H", "D"]);

// High-contrast ink: near-pure black for spades/clubs, a vivid saturated red
// for hearts/diamonds — both sit far past AA on the cream card stock.
const INK_BLACK = "#0a0a0a";
const INK_RED = "#d31027";

type CardSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<CardSize, string> = {
  xs: "w-9 h-[3.25rem] rounded-lg",
  sm: "w-14 h-20 rounded-xl",
  md: "w-20 h-28 rounded-2xl",
  lg: "w-24 h-32 rounded-2xl",
};

/**
 * Corner index — the hero of the card. In a fanned hand the cards overlap and
 * only this top-left corner is visible, so the rank is large and heavy for an
 * instant read.
 */
const CORNER_RANK: Record<CardSize, string> = {
  xs: "text-[11px]",
  sm: "text-[17px]",
  md: "text-[22px]",
  lg: "text-[26px]",
};

/** Big central suit symbol for full-card clarity (number/ace cards). */
const CENTER_SUIT: Record<CardSize, string> = {
  xs: "text-lg",
  sm: "text-4xl",
  md: "text-5xl",
  lg: "text-6xl",
};

/** Court-emblem SVG box sizing. */
const COURT_SIZE: Record<CardSize, string> = {
  xs: "w-4 h-4",
  sm: "w-8 h-8",
  md: "w-11 h-11",
  lg: "w-14 h-14",
};

const COURT_LETTER: Record<CardSize, string> = {
  xs: "text-sm",
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
};

function CornerIndex({ rank, suit, size, rotated }: { rank: Rank; suit: Suit; size: CardSize; rotated?: boolean }) {
  return (
    <span
      className={[
        "absolute flex flex-col items-center font-black leading-[0.85]",
        rotated ? "bottom-1 right-1.5 rotate-180" : "top-1 left-1.5",
        CORNER_RANK[size],
      ].join(" ")}
    >
      <span>{rank}</span>
      <span className="text-[0.72em] -mt-[0.05em]">{SUIT_SYMBOL[suit]}</span>
    </span>
  );
}

/** A distinct court emblem per face rank: crown (K), tiara (Q), fleur-de-lis (J). */
function CourtEmblem({ rank, size }: { rank: Rank; size: CardSize }) {
  const cls = ["drop-shadow-[0_1px_0_rgba(0,0,0,0.18)]", COURT_SIZE[size]].join(" ");
  if (rank === "K") {
    return (
      <svg viewBox="0 0 100 100" className={cls} fill="currentColor" aria-hidden>
        <path d="M14 74 L8 30 L30 48 L50 18 L70 48 L92 30 L86 74 Z" />
        <rect x="14" y="74" width="72" height="12" rx="2" />
        <circle cx="50" cy="16" r="6" />
      </svg>
    );
  }
  if (rank === "Q") {
    return (
      <svg viewBox="0 0 100 100" className={cls} fill="currentColor" aria-hidden>
        <path d="M16 72 Q14 40 28 46 Q36 24 50 40 Q64 24 72 46 Q86 40 84 72 Z" />
        <rect x="16" y="72" width="68" height="11" rx="2" />
        <circle cx="28" cy="42" r="5" />
        <circle cx="50" cy="34" r="5" />
        <circle cx="72" cy="42" r="5" />
      </svg>
    );
  }
  // Jack — fleur-de-lis
  return (
    <svg viewBox="0 0 100 100" className={cls} fill="currentColor" aria-hidden>
      <path d="M50 8 C44 24 42 30 50 40 C58 30 56 24 50 8 Z" />
      <path d="M50 40 C40 28 24 30 26 48 C28 64 44 60 50 46 C56 60 72 64 74 48 C76 30 60 28 50 40 Z" />
      <path d="M42 58 h16 v6 h-16 Z" />
      <path d="M50 46 C48 66 46 76 40 88 h20 C54 76 52 66 50 46 Z" />
    </svg>
  );
}

export function CardFace({
  card,
  selectable,
  highlight,
  onClick,
  size = "md",
}: {
  card: CardType;
  /** Whether this card can be clicked at all. */
  selectable?: boolean;
  /** Whether to show the "safe to play" glow — distinct from selectable, since any card may be played. */
  highlight?: boolean;
  onClick?: () => void;
  size?: CardSize;
}) {
  const isRed = RED_SUITS.has(card.suit);
  const isCourt = card.rank === "J" || card.rank === "Q" || card.rank === "K";

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onClick}
      aria-label={`${card.rank} of ${SUIT_NAME[card.suit]}`}
      style={{ color: isRed ? INK_RED : INK_BLACK }}
      className={[
        SIZE_CLASSES[size],
        "relative flex items-center justify-center overflow-hidden",
        "bg-gradient-to-b from-white via-[#fdfaf0] to-[#f2e9cf] ring-1 ring-inset ring-gold-400/40 border",
        "shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)]",
        highlight
          ? "border-gold-400/80 ring-2 ring-gold-400/70 cursor-pointer hover:-translate-y-2.5 hover:scale-[1.03] hover:shadow-[0_16px_28px_-8px_rgba(227,189,93,0.5)] transition-all duration-200 ease-out"
          : selectable
            ? "border-[#d8cba3] cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_14px_24px_-8px_rgba(0,0,0,0.45)] transition-all duration-200 ease-out"
            : "border-[#d8cba3] transition-opacity duration-300",
        !selectable ? "opacity-80 saturate-[0.9]" : "",
      ].join(" ")}
    >
      <CornerIndex rank={card.rank} suit={card.suit} size={size} />

      {isCourt ? (
        <span className="flex flex-col items-center justify-center gap-0.5 leading-none">
          <CourtEmblem rank={card.rank} size={size} />
          <span className={["font-display font-bold leading-none", COURT_LETTER[size]].join(" ")}>{card.rank}</span>
        </span>
      ) : (
        <span className={["leading-none drop-shadow-[0_1px_0_rgba(0,0,0,0.1)]", CENTER_SUIT[size]].join(" ")}>
          {SUIT_SYMBOL[card.suit]}
        </span>
      )}

      <CornerIndex rank={card.rank} suit={card.suit} size={size} rotated />
    </button>
  );
}

export function CardBack({ size = "sm" }: { size?: CardSize }) {
  return (
    <div
      className={[
        SIZE_CLASSES[size],
        "relative overflow-hidden bg-gradient-to-br from-felt-600 via-felt-800 to-felt-950",
        "border border-gold-600/40 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.6)]",
        "before:absolute before:inset-1.5 before:rounded-[inherit] before:border before:border-gold-400/25",
      ].join(" ")}
    >
      <span className="absolute inset-0 bg-kolam opacity-[0.35]" style={{ backgroundSize: "22px 22px" }} />
      {/* glossy sheen for a lacquered card-back finish */}
      <span className="absolute -inset-x-2 -top-3 h-1/2 bg-gradient-to-b from-white/15 to-transparent rotate-2 pointer-events-none" />
      <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto w-1/2 h-1/2 opacity-80" fill="none">
        <path d="M12 3c3 4 7 7 7 11a7 7 0 0 1-14 0c0-4 4-7 7-11Z" fill="none" stroke="#e3bd5d" strokeWidth="1.1" />
        <circle cx="12" cy="12" r="1.4" fill="#e3bd5d" />
      </svg>
    </div>
  );
}

export const SUIT_SYMBOLS = SUIT_SYMBOL;
