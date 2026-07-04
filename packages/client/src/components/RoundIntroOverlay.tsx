/** A brief, non-blocking "Round X of Y" flash shown center-screen at the start
    of each hand. Purely decorative (pointer-events-none) so it never gets in
    the way of the cut prompt underneath — it fades itself out and App unmounts
    it after ~2.2s. When the room has no round cap, just shows "Round X". */
export function RoundIntroOverlay({ round, maxRounds }: { round: number; maxRounds: number }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none animate-round-intro"
      style={{ background: "radial-gradient(ellipse at center, rgba(3,15,11,0.72) 0%, rgba(3,15,11,0.35) 45%, rgba(3,15,11,0) 75%)" }}
      aria-live="polite"
    >
      <div className="text-center">
        <div className="text-gold-300/70 text-sm sm:text-base font-semibold uppercase tracking-[0.35em] mb-2">
          Round
        </div>
        <div className="font-display font-semibold leading-none text-transparent bg-clip-text bg-gradient-to-b from-gold-300 via-gold-400 to-gold-600 text-[6rem] sm:text-[9rem] drop-shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
          {round}
        </div>
        {maxRounds > 0 && (
          <div className="text-ink-dim/70 text-lg sm:text-2xl font-medium mt-1">of {maxRounds}</div>
        )}
      </div>
    </div>
  );
}
