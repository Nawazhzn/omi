import type { Card as CardType, Suit } from "@omi/engine";

const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RED_SUITS = new Set<Suit>(["H", "D"]);

type CardSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<CardSize, string> = {
  xs: "w-9 h-[3.25rem] text-sm rounded-lg",
  sm: "w-14 h-20 text-lg rounded-xl",
  md: "w-20 h-28 text-2xl rounded-2xl",
  lg: "w-24 h-32 text-3xl rounded-2xl",
};

const PIP_SIZE: Record<CardSize, string> = {
  xs: "text-[8px]",
  sm: "text-[11px]",
  md: "text-xs",
  lg: "text-sm",
};

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
  const colorClass = isRed ? "text-ruby-700" : "text-felt-950";

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onClick}
      className={[
        SIZE_CLASSES[size],
        "relative flex flex-col items-center justify-center font-extrabold",
        "bg-gradient-to-b from-[#fdfaf1] via-[#fbf6e8] to-[#f2e9d0] ring-1 ring-inset ring-gold-400/40 border",
        "shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)]",
        colorClass,
        highlight
          ? "border-gold-400/80 ring-2 ring-gold-400/70 cursor-pointer hover:-translate-y-2.5 hover:scale-[1.03] hover:shadow-[0_16px_28px_-8px_rgba(227,189,93,0.5)] transition-all duration-200 ease-out"
          : selectable
            ? "border-[#d8cba3] cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_14px_24px_-8px_rgba(0,0,0,0.45)] transition-all duration-200 ease-out"
            : "border-[#d8cba3] transition-opacity duration-300",
        !selectable ? "opacity-75 saturate-[0.85]" : "",
      ].join(" ")}
    >
      <span className={["absolute top-1 left-1.5 leading-none flex flex-col items-center", PIP_SIZE[size]].join(" ")}>
        <span>{card.rank}</span>
        <span>{SUIT_SYMBOL[card.suit]}</span>
      </span>

      <span className="drop-shadow-sm">{SUIT_SYMBOL[card.suit]}</span>
      <span className="text-[0.6em] -mt-1 tracking-wide">{card.rank}</span>

      <span
        className={[
          "absolute bottom-1 right-1.5 leading-none flex flex-col items-center rotate-180",
          PIP_SIZE[size],
        ].join(" ")}
      >
        <span>{card.rank}</span>
        <span>{SUIT_SYMBOL[card.suit]}</span>
      </span>
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
