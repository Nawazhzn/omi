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
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="ring-foil bg-felt-800/95 rounded-[1.75rem] p-10 shadow-2xl text-center text-ink min-w-[320px]">
        <div className="text-5xl mb-2">🏆</div>
        <h2 className="font-display text-4xl font-semibold mb-2 bg-gradient-to-b from-gold-300 to-gold-600 bg-clip-text text-transparent">
          Team {winningTeam === 0 ? "A" : "B"} wins!
        </h2>
        <p className="text-ink-dim mb-8 text-lg">
          Final tokens — A <span className="font-bold text-ink">{tokens[0]}</span>
          <span className="text-ink-dim/40"> – </span>
          B <span className="font-bold text-ink">{tokens[1]}</span>
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
