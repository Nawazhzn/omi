import { useState } from "react";
import { CardBack } from "./Card.js";

export function CutDeckModal({ onCut }: { onCut: (cutPosition: number) => void }) {
  const [cutting, setCutting] = useState(false);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (cutting) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientY - rect.top) / rect.height;
    const pos = Math.min(31, Math.max(1, Math.round(fraction * 30) + 1));
    setCutting(true);
    setTimeout(() => onCut(pos), 800);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="ring-foil bg-felt-800/95 rounded-[1.75rem] p-8 shadow-2xl text-center w-full max-w-[20rem]">
        <div className="text-gold-300 text-xs font-medium uppercase tracking-widest mb-3">Your cut</div>
        <h2 className="font-display text-ink text-3xl font-semibold mb-1">Cut the deck</h2>
        <p className="text-ink-dim/75 text-sm mb-7">Tap anywhere on the deck to split it.</p>

        <div className="relative w-24 h-40 mx-auto cursor-pointer select-none" onClick={handleClick}>
          <div
            className="absolute left-0 w-full transition-all duration-700 ease-out"
            style={{
              top: "20px",
              transform: cutting ? "translateY(-44px)" : "translateY(0px)",
              opacity: cutting ? 0 : 1,
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="absolute left-0 w-full" style={{ top: `${i * 2}px` }}>
                <CardBack size="sm" />
              </div>
            ))}
          </div>
          <div
            className="absolute left-0 w-full transition-all duration-700 ease-out"
            style={{
              transform: cutting ? "translateY(70px)" : "translateY(0px)",
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="absolute left-0 w-full" style={{ top: `${i * 2}px` }}>
                <CardBack size="sm" />
              </div>
            ))}
          </div>
          {!cutting && (
            <div className="absolute -left-2 -right-2 top-1/2 border-t-2 border-dashed border-gold-400/70" />
          )}
        </div>

        <p className="text-gold-300/85 text-xs mt-5 h-4">{cutting ? "Cutting…" : ""}</p>
      </div>
    </div>
  );
}
