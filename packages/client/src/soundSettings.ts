const STORAGE_KEY = "omi.soundEnabled";
const listeners = new Set<(enabled: boolean) => void>();

function readStored(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

let enabled = readStored();

export function isSoundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(next: boolean) {
  enabled = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // localStorage unavailable — setting just won't persist across reloads.
  }
  listeners.forEach((l) => l(enabled));
}

export function onSoundSettingChange(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
