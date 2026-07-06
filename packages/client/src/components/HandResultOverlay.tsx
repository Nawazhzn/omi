import type { DareResult, HandResult, Team } from "@omi/engine";
import { ContinuePrompt } from "./ContinuePrompt.js";
import { CornerAccent } from "./CornerAccent.js";

const TEAM_TEXT: Record<Team, string> = { 0: "text-sapphire-300", 1: "text-ruby-300" };

function DareRevealBanner({ dare }: { dare: DareResult }) {
  if (dare.cancelled) {
    return (
      <p className="inline-block bg-white/10 text-ink-dim font-semibold px-4 py-1.5 rounded-full mb-3 text-sm">
        🎲 Dare cancelled — stakes refunded
      </p>
    );
  }

  const teamADelta = dare.coinsDelta[0];
  const teamBDelta = dare.coinsDelta[1];

  return (
    <div className="mb-1">
      <div className="flex items-center justify-center gap-3 text-sm font-semibold">
        <span className={teamADelta >= 0 ? "text-sapphire-300" : "text-ink-dim/60"}>
          Team A {teamADelta > 0 ? "+" : ""}{teamADelta}
        </span>
        <span className="text-ink-dim/30">·</span>
        <span className={teamBDelta >= 0 ? "text-ruby-300" : "text-ink-dim/60"}>
          Team B {teamBDelta > 0 ? "+" : ""}{teamBDelta}
        </span>
        <span className="text-ink-dim/50 text-xs">coins each</span>
      </div>
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
  // Who won THIS hand, and by how much — the token award already encodes it.
  const aTok = result.tokensAwarded[0];
  const bTok = result.tokensAwarded[1];
  const handWinner: Team | null = result.forfeit ? null : aTok > bTok ? 0 : bTok > aTok ? 1 : null;
  const winAmount = handWinner === null ? 0 : result.tokensAwarded[handWinner];

  // A short reason tag under the headline.
  const reason = result.flag
    ? `Team ${result.flag.offendingTeam === 0 ? "A" : "B"} broke suit`
    : result.kapothi
      ? "Kapothi — all 8 tricks!"
      : result.slamFailedTeam !== null
        ? `Team ${result.slamFailedTeam === 0 ? "A" : "B"}'s slam failed`
        : null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative ring-foil bg-felt-800/95 rounded-[1.75rem] px-8 py-7 shadow-2xl text-center text-ink w-[min(92vw,26rem)] overflow-hidden">
        <CornerAccent className="absolute -top-1 -left-1 w-7 h-7" />
        <CornerAccent className="absolute -bottom-1 -right-1 w-7 h-7 rotate-180" />

        {/* Anime speed-line burst behind a winner headline */}
        {handWinner !== null && <div className="absolute inset-0 bg-speedlines opacity-40 pointer-events-none" />}

        <div className="relative">
          {result.forfeit ? (
            <>
              <div className="text-4xl mb-1">🏳️</div>
              <h2 className="font-display text-3xl font-bold">Round Void</h2>
              <p className="text-ink-dim/80 text-sm mt-1">
                Team {result.forfeit.team === 0 ? "A" : "B"} held no trump and forfeited — no points to anyone.
              </p>
            </>
          ) : handWinner !== null ? (
            <div className="animate-impact-pop">
              <div className="text-xs uppercase tracking-[0.3em] text-ink-dim/60">Round won by</div>
              <div className={["font-display font-bold text-5xl sm:text-6xl mt-1 leading-none", TEAM_TEXT[handWinner]].join(" ")}>
                Team {handWinner === 0 ? "A" : "B"}
              </div>
              <div className="mt-2 text-2xl font-bold text-gold-300">
                +{winAmount} {winAmount === 1 ? "token" : "tokens"}
              </div>
              {reason && <div className="mt-1 text-xs font-semibold text-ink-dim/70">{reason}</div>}
            </div>
          ) : (
            <>
              <h2 className="font-display text-3xl font-semibold">It's a tie</h2>
              {result.pendingBonusAfter > 0 && (
                <p className="text-gold-300 text-sm mt-1 font-semibold">+{result.pendingBonusAfter} bonus carries to next round</p>
              )}
            </>
          )}
        </div>

        {/* Details row */}
        <div className="relative mt-4 space-y-2">
          <p className="text-ink-dim text-sm">
            Tricks <span className="font-bold text-sapphire-300">{result.trickCounts[0]}</span>
            <span className="text-ink-dim/40"> – </span>
            <span className="font-bold text-ruby-300">{result.trickCounts[1]}</span>
            <span className="mx-2 text-ink-dim/30">·</span>
            Tokens <span className="font-bold text-sapphire-300">{result.tokensAwarded[0]}</span>
            <span className="text-ink-dim/40"> – </span>
            <span className="font-bold text-ruby-300">{result.tokensAwarded[1]}</span>
          </p>
          {result.dare && <DareRevealBanner dare={result.dare} />}
        </div>

        <div className="relative mt-5">
          <ContinuePrompt seconds={5} label="Ready for the next round?" onContinue={onContinue} />
        </div>
      </div>
    </div>
  );
}
