/**
 * How the multiplier grows with time. The server sends K to the app (hello / run), so the rocket on screen and
 * the server agree on what the multiplier was at a given moment. 0.10: 2x after 6.9 s, 10x after 23 s.
 */
export const K_PER_SEC = 0.10;

/** Multiplier x100 after `ms` of flight, floored. */
export function x100At(ms: number): number {
  if (ms <= 0) return 100;
  return Math.floor(100 * Math.exp((K_PER_SEC * ms) / 1000));
}

/** Milliseconds of flight until the multiplier reaches x100. */
export function msTo(x100: number): number {
  if (x100 <= 100) return 0;
  return Math.ceil((Math.log(x100 / 100) / K_PER_SEC) * 1000);
}
