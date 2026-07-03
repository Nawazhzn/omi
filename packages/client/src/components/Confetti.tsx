import { useMemo } from "react";

const COLORS = ["#e3bd5d", "#f3d78a", "#7fb8e0", "#e39ab0", "#f4ecd8"];

/** A one-shot burst of falling confetti — purely decorative, no cleanup
    needed since it lives only as long as the celebrating screen does.
    `accentColor` lets the winning team's own color show up more often. */
export function Confetti({ accentColor }: { accentColor: string }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        drift: (Math.random() - 0.5) * 160,
        rotation: 360 + Math.random() * 360,
        duration: 2.6 + Math.random() * 1.8,
        delay: Math.random() * 0.8,
        size: 6 + Math.random() * 6,
        color: Math.random() < 0.35 ? accentColor : COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.5,
      })),
    [accentColor]
  );

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden pointer-events-none" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={
            {
              position: "absolute",
              top: 0,
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.4,
              backgroundColor: p.color,
              borderRadius: p.round ? "9999px" : "2px",
              animation: `confetti-fall ${p.duration}s cubic-bezier(0.4, 0.1, 0.6, 1) ${p.delay}s both`,
              "--x": `${p.drift}px`,
              "--r": `${p.rotation}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
