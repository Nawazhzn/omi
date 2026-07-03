import { useDareCountdown } from "../useDareCountdown.js";

export function DareChallengeModal({
  seconds,
  allInAvailable,
  onAction,
}: {
  seconds: number;
  allInAvailable: boolean;
  onAction: (action: "pass" | "dare" | "allin") => void;
}) {
  const remaining = useDareCountdown(seconds);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-ruby-700/90 to-felt-900 ring-2 ring-ruby-500/50 rounded-[1.75rem] p-8 shadow-[0_0_60px_rgba(168,48,79,0.35)] text-center w-full max-w-[24rem]">
        <div className="text-ruby-300 text-xs font-bold uppercase tracking-widest mb-2">Omi Dare Mode</div>
        <h2 className="font-display text-ink text-3xl font-semibold mb-1">Will you Dare them?</h2>
        <p className="text-ink-dim/80 text-sm mb-1">Trump is set. Think they'll fail?</p>
        <div className="text-gold-300 font-bold text-3xl mb-6 tabular-nums">{remaining}s</div>

        <div className="grid grid-cols-1 gap-2.5">
          <button
            onClick={() => onAction("dare")}
            className="shine-surface bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950 font-bold py-3 rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-transform duration-150 ease-out"
          >
            🎲 Dare — x2 coins
          </button>
          <button
            onClick={() => onAction("allin")}
            disabled={!allInAvailable}
            className={[
              "font-bold py-3 rounded-xl shadow-md transition-transform duration-150 ease-out",
              allInAvailable
                ? "bg-gradient-to-r from-ruby-600 to-ruby-700 text-white hover:scale-[1.02] active:scale-95"
                : "bg-white/10 text-white/40 cursor-not-allowed",
            ].join(" ")}
          >
            🔥 All-In Dare — x6 coins{!allInAvailable && " (used)"}
          </button>
          <button
            onClick={() => onAction("pass")}
            className="bg-white/10 text-ink font-semibold py-2.5 rounded-xl hover:bg-white/20 active:scale-95 transition-all duration-150"
          >
            Play Safe — no bet
          </button>
        </div>
      </div>
    </div>
  );
}
