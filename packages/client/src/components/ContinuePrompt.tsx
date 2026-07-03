import { useEffect, useState } from "react";

export function ContinuePrompt({
  seconds,
  label,
  onContinue,
  compact,
}: {
  seconds: number;
  label: string;
  onContinue: () => void;
  compact?: boolean;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const start = Date.now();
    setRemaining(seconds);
    const id = setInterval(() => {
      const left = Math.max(0, seconds - Math.floor((Date.now() - start) / 1000));
      setRemaining(left);
    }, 250);
    return () => clearInterval(id);
  }, [seconds, label]);

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 text-xs">
        <span className="text-ink-dim/75 font-medium">{label}</span>
        <button
          onClick={onContinue}
          className="shine-surface bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950 font-bold px-4 py-1.5 rounded-full shadow-[0_4px_14px_-4px_rgba(227,189,93,0.6)] hover:scale-105 hover:brightness-105 active:scale-95 transition-all duration-150 ease-out"
        >
          Continue <span className="opacity-70 font-semibold">· {remaining}s</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-ink text-sm font-medium">{label}</p>
      <button
        onClick={onContinue}
        className="shine-surface bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950 font-bold px-7 py-2.5 rounded-full shadow-md hover:scale-105 active:scale-95 transition-transform duration-150 ease-out"
      >
        Continue <span className="opacity-60 font-medium">({remaining}s)</span>
      </button>
    </div>
  );
}
