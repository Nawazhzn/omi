import type { DareResult, HandResult } from "@omi/engine";
import { ContinuePrompt } from "./ContinuePrompt.js";

function DareRevealBanner({ dare }: { dare: DareResult }) {
  if (dare.cancelled) {
    return (
      <p className="inline-block bg-white/10 text-ink-dim font-semibold px-4 py-1.5 rounded-full mb-3">
        🎲 Dare cancelled — stakes refunded
      </p>
    );
  }

  const winnerLabel = dare.winnerTeam === 0 ? "A" : "B";
  const headline = dare.kapothiBonusApplied
    ? `🔥 DARE CRUSHED! Team ${winnerLabel} swept it`
    : `🎲 Dare won by Team ${winnerLabel}`;

  return (
    <div className="mb-3">
      <p
        className={[
          "inline-block font-bold px-4 py-1.5 rounded-full",
          dare.kapothiBonusApplied ? "bg-ruby-600 text-white" : "bg-gradient-to-r from-gold-300 to-gold-500 text-felt-950",
        ].join(" ")}
      >
        {headline}
      </p>
      <div className="flex items-center justify-center gap-2 mt-2 text-xs">
        {dare.streakBonusApplied && (
          <span className="bg-[#c97a2e]/20 text-[#e3a15c] px-2 py-1 rounded-full font-semibold">
            🔥 {dare.streakAfter}-win streak bonus
          </span>
        )}
        {dare.comebackBonusApplied && (
          <span className="bg-sapphire-500/20 text-sapphire-300 px-2 py-1 rounded-full font-semibold">💪 Comeback bonus</span>
        )}
      </div>
    </div>
  );
}

export function HandResultOverlay({ result, onContinue }: { result: HandResult; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="ring-foil bg-felt-800/95 rounded-[1.75rem] p-8 shadow-2xl text-center text-ink min-w-[300px]">
        <h2 className="font-display text-2xl font-semibold mb-3">{result.flag ? "🚩 Flag confirmed" : "Hand complete"}</h2>
        {result.flag ? (
          <p className="inline-block bg-ruby-600 text-white font-bold px-4 py-1.5 rounded-full mb-4">
            Team {result.flag.offendingTeam === 0 ? "A" : "B"} didn't follow suit — the hand ends here.
          </p>
        ) : (
          <p className="text-ink-dim mb-4 text-lg">
            Tricks <span className="font-bold text-ink">{result.trickCounts[0]}</span>
            <span className="text-ink-dim/40"> – </span>
            <span className="font-bold text-ink">{result.trickCounts[1]}</span>
          </p>
        )}
        {result.kapothi && (
          <p className="inline-block bg-gradient-to-r from-gold-300 to-gold-500 text-felt-950 font-bold px-4 py-1.5 rounded-full mb-3">
            🎉 Kapothi! Team {result.kapothiTeam === 0 ? "A" : "B"} swept all 8 tricks
          </p>
        )}
        {result.slamFailedTeam !== null && (
          <p className="inline-block bg-ruby-600 text-white font-extrabold px-4 py-1.5 rounded-full mb-3">
            ⚠️ Team {result.slamFailedTeam === 0 ? "A" : "B"} declared a slam and lost a late trick — forfeit!
          </p>
        )}
        {result.dare && <DareRevealBanner dare={result.dare} />}
        <p className="text-ink-dim font-medium">
          Tokens awarded — A <span className="font-bold text-ink">+{result.tokensAwarded[0]}</span>, B{" "}
          <span className="font-bold text-ink">+{result.tokensAwarded[1]}</span>
        </p>
        {result.dare && !result.dare.cancelled && (
          <p className="text-gold-300/90 text-sm mt-1.5 font-medium">
            💰{" "}
            {result.dare.coinsDelta
              .filter((d) => d !== 0)
              .map((d) => `${d > 0 ? "+" : ""}${d}`)
              .join(" / ")}{" "}
            coins per player
          </p>
        )}
        {result.pendingBonusAfter > 0 && (
          <p className="text-gold-300 text-sm mt-2 font-semibold">
            Tie — +{result.pendingBonusAfter} bonus carries to the next hand
          </p>
        )}
        <div className="mt-6">
          <ContinuePrompt seconds={15} label="Ready for the next hand?" onContinue={onContinue} />
        </div>
      </div>
    </div>
  );
}
