import { useState } from "react";
import { isSoundEnabled, setSoundEnabled } from "../soundSettings.js";

export function SoundToggle() {
  const [enabled, setEnabled] = useState(isSoundEnabled());

  return (
    <button
      onClick={() => {
        const next = !enabled;
        setSoundEnabled(next);
        setEnabled(next);
      }}
      title={enabled ? "Mute sound" : "Unmute sound"}
      aria-label={enabled ? "Mute sound" : "Unmute sound"}
      className="text-ink-dim/85 hover:text-gold-300 transition-colors duration-150"
    >
      {enabled ? "🔊" : "🔇"}
    </button>
  );
}
