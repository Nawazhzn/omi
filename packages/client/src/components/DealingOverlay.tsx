import { useEffect, useMemo, useState } from "react";
import type { Seat } from "@omi/engine";
import { CardBack } from "./Card.js";

type Direction = "top" | "right" | "bottom" | "left";

const OFFSET: Record<Direction, { x: number; y: number }> = {
  top: { x: 0, y: -150 },
  right: { x: 150, y: 0 },
  bottom: { x: 0, y: 150 },
  left: { x: -150, y: 0 },
};

const STEP_MS = 200;

export function DealingOverlay({
  mySeat,
  partner,
  left,
  right,
  dealerSeat,
  onDone,
}: {
  mySeat: Seat;
  partner: Seat;
  left: Seat;
  right: Seat;
  dealerSeat: Seat;
  onDone: () => void;
}) {
  const direction = (seat: Seat): Direction => {
    if (seat === mySeat) return "bottom";
    if (seat === partner) return "top";
    if (seat === left) return "left";
    return "right";
  };

  // Cards originate from the dealer and are dealt clockwise (seat index +1),
  // four cards per round, the dealer receiving last in each round.
  const order = useMemo(() => {
    const seq: Seat[] = [];
    for (let round = 0; round < 4; round++) {
      for (let i = 1; i <= 4; i++) {
        seq.push(((dealerSeat + i) % 4) as Seat);
      }
    }
    return seq;
  }, [dealerSeat]);

  const [landed, setLanded] = useState(-1);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      setLanded(i);
      i++;
      if (i >= order.length) {
        clearInterval(id);
        setTimeout(onDone, 650);
      }
    }, STEP_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return (
    <div className="fixed inset-0 bg-black/35 backdrop-blur-[2px] flex items-center justify-center z-40 pointer-events-none">
      <div className="relative w-[22rem] h-[22rem]">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-90">
          <CardBack size="sm" />
        </div>
        {order.map((seat, i) => {
          const round = Math.floor(i / 4);
          const dir = direction(seat);
          const base = OFFSET[dir];
          const jitter = {
            x: base.x + (dir === "top" || dir === "bottom" ? round * 7 - 10 : round * 3),
            y: base.y + (dir === "left" || dir === "right" ? round * 7 - 10 : round * 3),
          };
          const shown = i <= landed;
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 transition-all ease-out"
              style={{
                transitionDuration: "600ms",
                transform: shown
                  ? `translate(-50%, -50%) translate(${jitter.x}px, ${jitter.y}px) rotate(${round * 6 - 9}deg)`
                  : "translate(-50%, -50%) scale(0.6)",
                opacity: shown ? 1 : 0,
              }}
            >
              <CardBack size="sm" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
