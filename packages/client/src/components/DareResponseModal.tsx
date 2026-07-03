import type { DareLevel } from "@omi/engine";
import { useDareCountdown } from "../useDareCountdown.js";
import { CornerAccent } from "./CornerAccent.js";

export function DareResponseModal({
  seconds,
  dareLevel,
  onAction,
}: {
  seconds: number;
  dareLevel: DareLevel;
  onAction: (action: "accept" | "safe" | "redare") => void;
}) {
  const remaining = useDareCountdown(seconds);
  const label = dareLevel === "dare" ? "x2" : dareLevel === "redare" ? "x4" : "x6";

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative bg-felt-800/95 ring-1 ring-gold-400/30 rounded-[1.75rem] p-8 shadow-[0_0_60px_-16px_rgba(227,189,93,0.4)] text-center w-full max-w-[24rem]">
        <CornerAccent className="absolute -top-1 -left-1 w-7 h-7" />
        <CornerAccent className="absolute -bottom-1 -right-1 w-7 h-7 rotate-180" />

        <div className="text-gold-300 text-xs font-bold uppercase tracking-widest mb-2">Omi Dare Mode</div>
        <h2 className="font-display text-ink text-3xl font-semibold mb-1">They Dared you — {label}!</h2>
        <p className="text-ink-dim/80 text-sm mb-1">Hold your nerve, or raise the stakes?</p>
        <div className="text-gold-300 font-bold text-3xl mb-6 tabular-nums">{remaining}s</div>

        <div className="grid grid-cols-1 gap-2.5">
          <button
            onClick={() => onAction("redare")}
            className="bg-gradient-to-r from-ruby-600 to-ruby-700 text-white font-bold py-3 rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-transform duration-150 ease-out"
          >
            🔥 Redare — push to x4
          </button>
          <button
            onClick={() => onAction("accept")}
            className="shine-surface bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950 font-bold py-3 rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-transform duration-150 ease-out"
          >
            Accept the Dare
          </button>
          <button
            onClick={() => onAction("safe")}
            className="bg-white/[0.06] ring-1 ring-white/10 text-ink font-semibold py-2.5 rounded-xl hover:bg-white/[0.1] active:scale-95 transition-all duration-150"
          >
            Play Safe — cancel the bet
          </button>
        </div>
      </div>
    </div>
  );
}
