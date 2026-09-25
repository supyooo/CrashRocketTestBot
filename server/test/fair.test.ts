import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crashFromBits, crashPoint, E52, makeChain, sha256hex, verifyRound } from '../src/game/fair.js';
import { msTo, x100At } from '../src/game/curve.js';

test('crash point is 1.00x at the bottom of the range and never below', () => {
  assert.equal(crashFromBits(0n, 300), 100);
  assert.equal(crashFromBits(1000n, 300), 100);
});

test('crash point follows (1 - edge) / U and is floored', () => {
  // U = 1/2  ->  0.97 / 0.5 = 1.94x
  assert.equal(crashFromBits(E52 / 2n, 300), 194);
  // U = 1/100 -> 97.00x
  assert.equal(crashFromBits(E52 - E52 / 100n, 300), 9700);
  // edge 0 and U = 1/3 -> 3.00x exactly, and flooring never shows more than the true value
  assert.equal(crashFromBits(E52 - E52 / 3n, 0), 300);
});

test('probability of reaching x matches (1 - edge) / x on a million rounds', () => {
  const n = 1_000_000;
  const targets = [150, 200, 500, 1000];
  const hits = new Map(targets.map((t) => [t, 0]));
  let seed = 123456789n;
  for (let i = 0; i < n; i++) {
    // cheap 52-bit LCG, good enough to check the formula's shape
    seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    const x = crashFromBits(seed >> 12n, 300);
    for (const t of targets) if (x >= t) hits.set(t, hits.get(t)! + 1);
  }
  for (const t of targets) {
    const p = hits.get(t)! / n;
    const expected = 0.97 / (t / 100);
    assert.ok(Math.abs(p - expected) < 0.004, `P(>=${t / 100}x) = ${p}, expected ${expected}`);
  }
});

test('hash chain: every revealed round hash leads back to the commitment', () => {
  const chain = makeChain('seed-for-test', 50);
  const commitment = chain[50]!;
  for (let round = 1; round <= 10; round++) {
    const gameHash = chain[50 - round]!;
    assert.ok(verifyRound(gameHash, round, commitment));
  }
  assert.equal(sha256hex(chain[49]!), chain[50]);
  assert.ok(!verifyRound(chain[40]!, 3, commitment));
});

test('crash point is deterministic for the same hash and salt', () => {
  const h = sha256hex('x');
  assert.equal(crashPoint(h, 'salt', 300), crashPoint(h, 'salt', 300));
});

test('curve: time to reach a multiplier and back agree', () => {
  for (const x of [101, 150, 200, 1000, 10000]) {
    assert.ok(x100At(msTo(x)) >= x);
    assert.ok(x100At(msTo(x) - 20) < x);
  }
  assert.equal(x100At(0), 100);
});
