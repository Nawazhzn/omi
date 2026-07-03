/**
 * Returns a cryptographically secure random integer in [0, max).
 * Uses the Web Crypto API (available in Node 19+ and all browsers) so this
 * module stays bundler-safe if ever pulled into client code, even though
 * shuffling must only ever happen server-side.
 */
export function secureRandomInt(max: number): number {
  if (max <= 0) throw new Error("max must be > 0");
  const range = Math.floor(max);
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % range);
  const buf = new Uint32Array(1);
  let value: number;
  do {
    globalThis.crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % range;
}
