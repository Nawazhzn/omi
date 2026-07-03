import { useEffect, useState } from "react";
import { isSoundEnabled } from "./soundSettings.js";

let sharedAudioCtx: AudioContext | null = null;

/** A short, soft tick — synthesized so the mode needs no audio asset. */
function playTick(urgent: boolean) {
  if (!isSoundEnabled()) return;
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
    const ctx = sharedAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = urgent ? 880 : 600;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Audio isn't available in every environment — fail silently.
  }
}

/** Counts down from `seconds`, ticking a soft beep each second (faster/higher-pitched in the final 3s). */
export function useDareCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const start = Date.now();
    setRemaining(seconds);
    let lastTick = seconds;
    const id = setInterval(() => {
      const left = Math.max(0, seconds - Math.floor((Date.now() - start) / 1000));
      setRemaining(left);
      if (left !== lastTick) {
        lastTick = left;
        if (left > 0) playTick(left <= 3);
      }
    }, 200);
    return () => clearInterval(id);
  }, [seconds]);

  return remaining;
}
