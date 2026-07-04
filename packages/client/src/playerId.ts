const STORAGE_KEY = "omi.playerId";

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // No crypto available (very old browser) — a weak id still beats none,
      // since this only gates reclaiming *your own* seat, not room access.
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
  }
}

/**
 * A stable per-browser identity, persisted in localStorage so it survives
 * tab closes and refreshes. Sent (privately) with room:create/room:join so
 * the server can recognise a returning player and give them their original
 * seat back instead of minting a duplicate "ghost" seat — the failure mode
 * when someone reconnects from a new tab or after a dropped connection.
 * Never broadcast to other players.
 */
export function getPlayerId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable — generate a per-page-load id instead.
    return randomId();
  }
}
