import { isSoundEnabled } from "./soundSettings.js";

let sharedAudioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/** A short synthesized tone — no audio assets needed. */
function playTone(freq: number, durationMs: number, volume = 0.06, type: OscillatorType = "sine") {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Audio isn't available in every environment — fail silently.
  }
}

/** A soft click when any card lands on the table. */
export function playCardSound() {
  playTone(320, 90, 0.05);
}

/** A brighter two-note chime when a trick is won. */
export function playTrickWonSound() {
  if (!isSoundEnabled()) return;
  playTone(520, 110, 0.06);
  setTimeout(() => playTone(700, 140, 0.06), 90);
}

/** A gentle rising note announcing it's the player's turn. */
export function playYourTurnSound() {
  if (!isSoundEnabled()) return;
  playTone(440, 90, 0.05);
  setTimeout(() => playTone(660, 160, 0.06), 80);
}

/** A short ascending fanfare for winning the full game. */
export function playVictorySound() {
  if (!isSoundEnabled()) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => setTimeout(() => playTone(freq, 260, 0.07, "triangle"), i * 110));
}

/** Short haptic pulse for the same "your turn" / "trick won" moments — tied to
    the sound toggle since this app doesn't expose a separate haptics setting. */
export function vibrate(pattern: number | number[]) {
  if (!isSoundEnabled()) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
