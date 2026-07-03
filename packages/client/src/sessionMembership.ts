import type { Seat } from "@omi/engine";

const STORAGE_KEY = "omi.membership";

export interface Membership {
  roomId: string;
  seat: Seat;
  rejoinToken: string;
}

/** sessionStorage (not localStorage): survives a same-tab refresh so a
    reconnect can reclaim the seat, but doesn't leak into a fresh tab or
    persist indefinitely once the tab closes. */
export function saveMembership(m: Membership) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    // sessionStorage unavailable — reconnect-to-seat just won't work this session.
  }
}

export function readMembership(): Membership | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Membership) : null;
  } catch {
    return null;
  }
}

export function clearMembership() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
