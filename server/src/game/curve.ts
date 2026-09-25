/**
 * How the multiplier grows with time. Must match the client (app/index.html uses K = 0.12 per second),
 * so the rocket on screen and the server agree on what the multiplier was at a given moment.
 */
export const K_PER_SEC = 0.12;

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
