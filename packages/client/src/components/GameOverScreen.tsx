import { useEffect } from "react";
import { Confetti } from "./Confetti.js";
import { CornerAccent } from "./CornerAccent.js";
import { playVictorySound } from "../soundEffects.js";

const TEAM_ACCENT: Record<0 | 1, { hex: string; text: string }> = {
  0: { hex: "#7fb8e0", text: "text-sapphire-300" },
  1: { hex: "#e39ab0", text: "text-ruby-300" },
};

export function GameOverScreen({
  winningTeam,
  tokens,
  onRematch,
  onHome,
}: {
  winningTeam: 0 | 1;
  tokens: [number, number];
  onRematch: () => void;
  onHome: () => void;
}) {
  useEffect(() => {
    playVictorySound();
  }, []);

  const accent = TEAM_ACCENT[winningTeam];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Confetti accentColor={accent.hex} />

      <div className="relative ring-foil bg-felt-800/95 rounded-[1.75rem] p-10 shadow-2xl text-center text-ink min-w-[320px]">
        <CornerAccent className="absolute -top-1 -left-1 w-8 h-8" />
        <CornerAccent className="absolute -bottom-1 -right-1 w-8 h-8 rotate-180" />

        <div className="text-5xl mb-2">🏆</div>
        <h2 className="font-display text-4xl font-semibold mb-2">
          Team <span className={accent.text}>{winningTeam === 0 ? "A" : "B"}</span> wins!
        </h2>
        <p className="text-ink-dim mb-8 text-lg">
          Final tokens — <span className="font-bold text-sapphire-300">A {tokens[0]}</span>
          <span className="text-ink-dim/40"> – </span>
          <span className="font-bold text-ruby-300">B {tokens[1]}</span>
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onRematch}
            className="shine-surface bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950 font-bold px-6 py-3 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-transform duration-150 ease-out"
          >
            Rematch
          </button>
          <button
            onClick={onHome}
            className="bg-white/10 px-6 py-3 rounded-xl font-semibold hover:bg-white/20 active:scale-95 transition-all duration-150"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
