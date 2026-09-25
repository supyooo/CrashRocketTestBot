/**
 * Provably fair crash points.
 *
 * A chain of SHA-256 hashes is generated once from a secret seed: c0 = seed, c[i+1] = sha256(c[i]).
 * Only the last link c[L] is published up front (the commitment). Rounds use the chain backwards:
 * round 1 uses c[L-1], round 2 uses c[L-2], and so on. Once a round is over its hash is revealed, and
 * anyone can check that hashing it `n` times gives the commitment, so no round could have been changed
 * after the commitment was published.
 *
 * The crash point comes from HMAC-SHA256(key = salt, message = round hash). The salt is public and fixed
 * before the first round (in production: a future blockchain block hash announced in advance), which
 * stops the operator from picking a seed that happens to produce a friendly chain.
 *
 * Multipliers are integers in hundredths (x100): 235 means 2.35x. Everything is integer maths so the
 * server, the verifier page and the simulator all get exactly the same numbers.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';

export const E52 = 2n ** 52n;

export function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** 52 uniformly distributed bits taken from a round hash and the public salt. */
export function roundBits(gameHash: string, salt: string): bigint {
  const hmac = createHmac('sha256', salt).update(gameHash).digest('hex');
  return BigInt('0x' + hmac.slice(0, 13));
}

/**
 * Crash point x100 for 52 random bits and a house edge in basis points (300 = 3%).
 * With U = (2^52 - h) / 2^52 in (0, 1], the point is floor(100 * (1 - edge) / U) / 100, at least 1.00x.
 * That gives P(crash >= x) = (1 - edge) / x, so every cash-out target returns exactly 1 - edge on average.
 * Flooring (never rounding up) keeps the shown multiplier at or below the true one.
 */
export function crashFromBits(h: bigint, edgeBps: number): number {
  const rtp = BigInt(10_000 - edgeBps);
  const x100 = (rtp * E52) / (100n * (E52 - h));
  return Number(x100 < 100n ? 100n : x100);
}

export function crashPoint(gameHash: string, salt: string, edgeBps: number): number {
  return crashFromBits(roundBits(gameHash, salt), edgeBps);
}

/** Builds c0..cL. Keep it on the server; publish only chain[L]. */
export function makeChain(seed: string, length: number): string[] {
  const chain = new Array<string>(length + 1);
  chain[0] = seed;
  for (let i = 1; i <= length; i++) chain[i] = sha256hex(chain[i - 1]!);
  return chain;
}

export function newSeed(): string {
  return randomBytes(32).toString('hex');
}

/** Verifier: hashing a revealed round hash `roundNo` times must give the published commitment. */
export function verifyRound(gameHash: string, roundNo: number, commitment: string): boolean {
  let h = gameHash;
  for (let i = 0; i < roundNo; i++) h = sha256hex(h);
  return h === commitment;
}
