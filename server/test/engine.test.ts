/**
 * The same game scenarios run against both stores: the dev JSON file and a real Postgres (embedded).
 * Plus Postgres-only checks for races and the dev-data import.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { config, toUnits } from '../src/config.js';
import { FileStore, InsufficientFunds, type Store } from '../src/store/store.js';
import { PgStore } from '../src/store/pg.js';
import { Wallet } from '../src/wallet/wallet.js';
import { Engine, GameError } from '../src/game/engine.js';
import { msTo } from '../src/game/curve.js';
import { startPg } from './pg-helper.js';

let pgUrl = '', stopPg: () => Promise<void> = async () => {};
before(async () => { const p = await startPg(); pgUrl = p.url; stopPg = p.stop; });
after(async () => { await stopPg(); });

let dbN = 0;
async function freshPg(): Promise<PgStore> {
  // each test gets its own database so tests cannot see each other's money
  const name = 'crash_t' + ++dbN;
  const admin = new pg.Client(pgUrl); await admin.connect(); await admin.query(`CREATE DATABASE ${name}`); await admin.end();
  return PgStore.open(pgUrl.replace(/\/crash$/, '/' + name));
}
async function freshFile(): Promise<{ store: FileStore; file: string }> {
  const file = join(mkdtempSync(join(tmpdir(), 'cr-')), 'db.json');
  return { store: new FileStore(file), file };
}
const cfgWith = (over: Partial<typeof config> = {}) => ({ ...config, chainLength: 2000, ...over });
const crashOf = (e: Engine) => (e as unknown as { crashX100: number }).crashX100;
const tick = () => new Promise((r) => setImmediate(r));
/** Money can only belong to an existing user (Postgres enforces it), so create the user first. */
async function grantU(store: Store, wallet: Wallet, uid: string, amount: number, ref: string) {
  if (!(await store.getUser(uid))) await store.putUser({ id: uid, name: uid, createdAt: Date.now() });
  return wallet.grant(uid, amount, ref);
}

for (const kind of ['file', 'postgres'] as const) {
  const open = async () => (kind === 'file' ? (await freshFile()).store : await freshPg());
  async function setup(over: Partial<typeof config> = {}) {
    const store: Store = await open();
    const cfg = cfgWith(over);
    const wallet = new Wallet(store);
    const engine = await Engine.create(cfg, store, wallet);
    return { cfg, store, wallet, engine };
  }
  /** Runs flights in 50 ms steps until the rocket is gone, letting async payouts finish. */
  async function fly(engine: Engine, t: number) {
    for (let k = 0; k < 4000 && engine.phase === 'running'; k++) { t += 50; engine.step(t); await tick(); }
    await engine.settled();
    return t;
  }

  test(`[${kind}] bet, cash out mid-flight, paid exactly once`, async () => {
    const { engine, wallet, cfg, store } = await setup();
    await grantU(store, wallet, 'u1', toUnits(10), 'grant:u1');
    let t = 1_000; await engine.start(t);
    await engine.placeBet('u1', 'Ann', toUnits(1));
    assert.equal(await wallet.balance('u1'), toUnits(9));
    t += cfg.bettingMs; engine.step(t);
    assert.equal(engine.phase, 'running');
    if (crashOf(engine) > 101) {
      const res = await engine.cashout('u1', t + 5);
      assert.equal(await wallet.balance('u1'), toUnits(9) + res.payout);
      await assert.rejects(async () => engine.cashout('u1', t + 20), /already cashed out/);
    }
    await fly(engine, t);
    assert.equal(engine.phase, 'crashed');
  });

  test(`[${kind}] cash-out at the crash moment is refused`, async () => {
    const { engine, wallet, cfg, store } = await setup();
    await grantU(store, wallet, 'u1', toUnits(100), 'g');
    let t = 0; await engine.start(t);
    await engine.placeBet('u1', 'Ann', toUnits(1));
    t += cfg.bettingMs; engine.step(t);
    const c = crashOf(engine);
    assert.throws(() => engine.cashout('u1', t + msTo(c)), /too late/);
  });

  test(`[${kind}] auto cash-out settles at exactly its multiplier`, async () => {
    const { engine, wallet, cfg, store } = await setup();
    await grantU(store, wallet, 'u1', toUnits(1000), 'g');
    let t = 0; await engine.start(t);
    for (let i = 0; i < 200; i++) {
      const before = await wallet.balance('u1');
      await engine.placeBet('u1', 'Ann', toUnits(2), 150);
      t += cfg.bettingMs; engine.step(t);
      const c = crashOf(engine);
      t = await fly(engine, t);
      if (c >= 150) { assert.equal(await wallet.balance('u1'), before - toUnits(2) + toUnits(3)); return; }
      assert.equal(await wallet.balance('u1'), before - toUnits(2));
      t += cfg.crashedMs; engine.step(t); await engine.settled(); await tick(); await tick();
    }
    assert.fail('no round reached 1.50x');
  });

  test(`[${kind}] max win caps the payout and cashes out automatically`, async () => {
    const { engine, wallet, cfg, store } = await setup({ maxWin: toUnits(3) });
    await grantU(store, wallet, 'u1', toUnits(1000), 'g');
    let t = 0; await engine.start(t);
    for (let i = 0; i < 300; i++) {
      const before = await wallet.balance('u1');
      await engine.placeBet('u1', 'Ann', toUnits(1));
      t += cfg.bettingMs; engine.step(t);
      const c = crashOf(engine);
      t = await fly(engine, t);
      if (c >= 300) { assert.equal(await wallet.balance('u1'), before - toUnits(1) + toUnits(3)); return; }
      t += cfg.crashedMs; engine.step(t); await engine.settled(); await tick(); await tick();
    }
    assert.fail('no round reached 3.00x');
  });

  test(`[${kind}] validation, cancel refunds, not enough money changes nothing`, async () => {
    const { engine, wallet, store } = await setup();
    await grantU(store, wallet, 'u1', toUnits(1), 'g');
    await engine.start(0);
    await assert.rejects(engine.placeBet('u1', 'Ann', toUnits(0.01)), /limits/);
    await assert.rejects(engine.placeBet('u1', 'Ann', toUnits(5)), InsufficientFunds);
    assert.equal(await wallet.balance('u1'), toUnits(1));
    await engine.placeBet('u1', 'Ann', toUnits(1));
    await assert.rejects(engine.placeBet('u1', 'Ann', toUnits(1)), /already/);
    await engine.cancelBet('u1');
    assert.equal(await wallet.balance('u1'), toUnits(1));
    await engine.placeBet('u1', 'Ann', toUnits(1)); // charged again after a cancel, not skipped as a duplicate
    assert.equal(await wallet.balance('u1'), 0);
  });

  test(`[${kind}] replaying a ledger ref never moves money twice`, async () => {
    const { wallet, store } = await setup();
    await grantU(store, wallet, 'u1', toUnits(5), 'same-ref');
    await grantU(store, wallet, 'u1', toUnits(5), 'same-ref');
    assert.equal(await wallet.balance('u1'), toUnits(5));
  });

  test(`[${kind}] a restart mid-round refunds stakes of the unfinished round`, async () => {
    const store = await open();
    const cfg = cfgWith();
    const wallet = new Wallet(store);
    const engine = await Engine.create(cfg, store, wallet);
    await grantU(store, wallet, 'u1', toUnits(10), 'g');
    await engine.start(0);
    await engine.placeBet('u1', 'Ann', toUnits(4));
    await engine.settled();
    // "restart": a new engine on the same data
    const engine2 = await Engine.create(cfg, store, new Wallet(store));
    assert.equal(await wallet.balance('u1'), toUnits(10));
    assert.ok((await store.fair())!.nextNo >= 2);
    void engine2;
  });

  test(`[${kind}] finished rounds are stored with their players`, async () => {
    const { engine, wallet, cfg, store } = await setup();
    await grantU(store, wallet, 'u1', toUnits(10), 'g');
    let t = 0; await engine.start(t);
    await engine.placeBet('u1', 'Ann', toUnits(1));
    t += cfg.bettingMs; engine.step(t);
    await fly(engine, t);
    const [r] = await store.rounds(1);
    assert.equal(r!.no, 1);
    assert.equal(r!.bets[0]!.uid, 'u1');
    assert.equal(await store.openRound(), undefined);
  });
}

test('[postgres] parallel stakes can never overdraw a balance', async () => {
  const store = await freshPg();
  const wallet = new Wallet(store);
  await grantU(store, wallet, 'u1', toUnits(5), 'g');
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => wallet.stake('u1', toUnits(1), 'race:' + i)));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
  assert.equal(await wallet.balance('u1'), 0);
  await store.close();
});

test('[postgres] the same ref sent in parallel is applied once', async () => {
  const store = await freshPg();
  const wallet = new Wallet(store);
  await store.putUser({ id: 'u1', name: 'u1', createdAt: Date.now() });
  await Promise.all(Array.from({ length: 10 }, () => wallet.grant('u1', toUnits(2), 'dup')));
  assert.equal(await wallet.balance('u1'), toUnits(2));
  await store.close();
});

test('[postgres] dev file data is imported once into an empty database', async () => {
  const { store: file, file: path } = await freshFile();
  await file.putUser({ id: 'dev:ann', name: 'ann', createdAt: Date.now() });
  await new Wallet(file).grant('dev:ann', toUnits(7), 'grant:start:dev:ann');
  await file.setFair({ seed: 's', commitment: 'c', length: 10, nextNo: 3 });
  await file.close();
  const pgStore = await freshPg();
  const snap = FileStore.read(path)!;
  assert.equal(await pgStore.importSnapshot(snap), true);
  assert.equal(await pgStore.balance('dev:ann'), toUnits(7));
  assert.equal((await pgStore.fair())!.nextNo, 3);
  assert.equal(await pgStore.importSnapshot(snap), false); // never twice
  await pgStore.close();
});

test('game errors are GameError instances', () => { assert.ok(new GameError('x') instanceof Error); });
