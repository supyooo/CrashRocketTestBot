import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config, toUnits } from '../src/config.js';
import { FileStore, InsufficientFunds } from '../src/store/store.js';
import { Wallet } from '../src/wallet/wallet.js';
import { Engine, GameError } from '../src/game/engine.js';
import { msTo } from '../src/game/curve.js';

function setup(over: Partial<typeof config> = {}) {
  const file = join(mkdtempSync(join(tmpdir(), 'cr-')), 'db.json');
  const cfg = { ...config, chainLength: 2000, ...over };
  const store = new FileStore(file);
  const wallet = new Wallet(store);
  const engine = new Engine(cfg, store, wallet);
  return { cfg, store, wallet, engine, file };
}
/** Plays rounds until one crashes at or above `min` (the chain is random per test). */
function roundAtLeast(e: Engine, cfg: typeof config, min: number, t0: number) {
  let t = t0;
  e.start(t);
  for (;;) {
    // peek: run a throwaway round to learn its crash point from the emitted event
    let crash = 0;
    const onCrash = (c: { crashX100: number }) => { crash = c.crashX100; };
    e.once('crash', onCrash);
    t += cfg.bettingMs; e.step(t);
    t += 1_000_000; e.step(t);
    if (crash >= min) return { t, crash };
    t += cfg.crashedMs; e.step(t);
  }
}

test('bet, cash out mid-flight, balance is paid exactly once', () => {
  const { engine, wallet, cfg } = setup();
  wallet.grant('u1', toUnits(10), 'grant:u1');
  let t = 1_000; engine.start(t);
  engine.placeBet('u1', 'Ann', toUnits(1));
  assert.equal(wallet.balance('u1'), toUnits(9));
  t += cfg.bettingMs; engine.step(t);
  assert.equal(engine.phase, 'running');
  // cash out 10 ms after launch: always before any crash point > 1.00x can trigger; the multiplier is ~1.00x
  const crashed = new Promise<number>((r) => engine.once('crash', (c) => r(c.crashX100)));
  let res: { x100: number; payout: number } | undefined;
  try { res = engine.cashout('u1', t + 10); } catch (err) { assert.ok(err instanceof GameError); }
  if (res) {
    assert.ok(res.x100 >= 100);
    assert.equal(wallet.balance('u1'), toUnits(9) + res.payout);
    assert.throws(() => engine.cashout('u1', t + 20), /already cashed out/);
  }
  engine.step(t + 10_000_000);
  return crashed.then((x) => assert.ok(x >= 100));
});

test('cash-out after the crash moment is refused', () => {
  const { engine, wallet, cfg } = setup();
  wallet.grant('u1', toUnits(100), 'g');
  const { t } = roundAtLeast(engine, cfg, 100, 0);
  let t2 = t + cfg.crashedMs; engine.step(t2); // new betting round
  engine.placeBet('u1', 'Ann', toUnits(1));
  t2 += cfg.bettingMs; engine.step(t2);
  let crash = 0; engine.once('crash', (c) => { crash = c.crashX100; });
  // ask exactly at the crash moment without stepping: must be too late
  const peek = (engine as unknown as { crashX100: number }).crashX100;
  assert.throws(() => engine.cashout('u1', t2 + msTo(peek)), /too late/);
  engine.step(t2 + msTo(peek)); assert.equal(crash, peek);
});

test('auto cash-out settles at exactly its multiplier when the rocket passes it', () => {
  const { engine, wallet, cfg } = setup();
  wallet.grant('u1', toUnits(100), 'g');
  // find a round that reaches 1.50x, then bet on the next ones until one of them does too
  let t = 0; engine.start(t);
  for (let i = 0; i < 200; i++) {
    const before = wallet.balance('u1');
    engine.placeBet('u1', 'Ann', toUnits(2), 150);
    t += cfg.bettingMs; engine.step(t);
    const peek = (engine as unknown as { crashX100: number }).crashX100;
    for (let k = 0; k < 400 && engine.phase === 'running'; k++) { t += 50; engine.step(t); }
    if (peek >= 150) { assert.equal(wallet.balance('u1'), before - toUnits(2) + toUnits(3)); return; }
    assert.equal(wallet.balance('u1'), before - toUnits(2));
    t += cfg.crashedMs; engine.step(t);
  }
  assert.fail('no round reached 1.50x in 200 tries');
});

test('max win caps the payout and cashes the bet out automatically', () => {
  const { engine, wallet, cfg } = setup({ maxWin: toUnits(3) });
  wallet.grant('u1', toUnits(100), 'g');
  let t = 0; engine.start(t);
  for (let i = 0; i < 300; i++) {
    const before = wallet.balance('u1');
    engine.placeBet('u1', 'Ann', toUnits(1));
    t += cfg.bettingMs; engine.step(t);
    const peek = (engine as unknown as { crashX100: number }).crashX100;
    for (let k = 0; k < 1000 && engine.phase === 'running'; k++) { t += 50; engine.step(t); }
    if (peek >= 300) { assert.equal(wallet.balance('u1'), before - toUnits(1) + toUnits(3)); return; }
    t += cfg.crashedMs; engine.step(t);
  }
  assert.fail('no round reached 3.00x');
});

test('bets are validated and cancel refunds; not enough money changes nothing', () => {
  const { engine, wallet } = setup();
  wallet.grant('u1', toUnits(1), 'g');
  engine.start(0);
  assert.throws(() => engine.placeBet('u1', 'Ann', toUnits(0.01)), /limits/);
  assert.throws(() => engine.placeBet('u1', 'Ann', toUnits(5)), InsufficientFunds);
  assert.equal(wallet.balance('u1'), toUnits(1));
  engine.placeBet('u1', 'Ann', toUnits(1));
  assert.throws(() => engine.placeBet('u1', 'Ann', toUnits(1)), /already/);
  engine.cancelBet('u1');
  assert.equal(wallet.balance('u1'), toUnits(1));
  // bet again in the same round after cancelling: charged again, not skipped by idempotency
  engine.placeBet('u1', 'Ann', toUnits(1));
  assert.equal(wallet.balance('u1'), 0);
});

test('replaying a ledger ref never moves money twice', () => {
  const { wallet } = setup();
  wallet.grant('u1', toUnits(5), 'same-ref');
  wallet.grant('u1', toUnits(5), 'same-ref');
  assert.equal(wallet.balance('u1'), toUnits(5));
});

test('a restart mid-round refunds stakes of the unfinished round', () => {
  const s = setup();
  s.wallet.grant('u1', toUnits(10), 'g');
  s.engine.start(0);
  s.engine.placeBet('u1', 'Ann', toUnits(4));
  s.store.flush();
  // "restart": new store and engine from the same file
  const store2 = new FileStore(s.file);
  const wallet2 = new Wallet(store2);
  new Engine(s.cfg, store2, wallet2);
  assert.equal(wallet2.balance('u1'), toUnits(10));
  // and round numbers keep moving forward: no hash is ever reused
  assert.ok(store2.fair()!.nextNo >= 2);
});
