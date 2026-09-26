/** TON gateway against a fake chain and a real (embedded) Postgres. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { Address } from '@ton/core';
import { config, toUnits } from '../src/config.js';
import { PgStore } from '../src/store/pg.js';
import { TonGateway } from '../src/ton/gateway.js';
import { commentCell, friendly, parseTestnetAddress, readComment, type InTx, type TonChain } from '../src/ton/chain.js';
import { startPg } from './pg-helper.js';

const rawAddr = () => '0:' + randomBytes(32).toString('hex');

/** Behaves like a wallet contract: a transfer executes only with the current seqno; anything else is dropped. */
class FakeChain implements TonChain {
  house = rawAddr();
  seq = 0; bal = 1_000_000_000_000n; txs: InTx[] = []; executed: { to: string; nano: bigint; seqno: number }[] = []; sends = 0; stall = false;
  async seqno() { return this.seq; }
  async balance() { return this.bal; }
  async incoming(limit: number) { return [...this.txs].reverse().slice(0, limit); }
  async send(seqno: number, to: string, nano: bigint) {
    this.sends++;
    if (this.stall || seqno !== this.seq) return;
    this.executed.push({ to, nano, seqno }); this.seq++; this.bal -= nano;
  }
  deposit(from: string, ton: number, comment: string, ok = true): InTx {
    const t = { hash: randomBytes(32).toString('hex'), lt: String(1000 + this.txs.length), source: from, nano: BigInt(Math.round(ton * 1e9)), comment, ok };
    this.txs.push(t); return t;
  }
}

let url = '', stop: () => Promise<void> = async () => {};
const opened: PgStore[] = [];
before(async () => { const p = await startPg(); url = p.url; stop = p.stop; });
after(async () => { for (const s of opened) await s.close().catch(() => {}); await stop(); });
let n = 0;
async function setup() {
  const name = 'ton_t' + ++n;
  const admin = new pg.Client(url); await admin.connect(); await admin.query(`CREATE DATABASE ${name}`); await admin.end();
  const store = await PgStore.open(url.replace(/\/crash$/, '/' + name)); opened.push(store);
  const chain = new FakeChain();
  const gw = new TonGateway(config, store.db, chain);
  for (const id of ['tg:1', 'tg:2']) await store.putUser({ id, name: id, createdAt: Date.now() });
  return { store, chain, gw };
}

test('comments round-trip and addresses must be testnet', () => {
  assert.equal(readComment(commentCell('CRABC123')), 'CRABC123');
  const raw = rawAddr();
  const testnet = Address.parseRaw(raw).toString({ testOnly: true, bounceable: false });
  const mainnet = Address.parseRaw(raw).toString({ testOnly: false, bounceable: false });
  assert.equal(parseTestnetAddress(testnet), raw);
  assert.throws(() => parseTestnetAddress(mainnet), /mainnet/);
  assert.equal(parseTestnetAddress(friendly(raw)), raw);
});

test('old play money is reset once, with ledger entries', async () => {
  const { store, gw } = await setup();
  await store.applyLedger([{ uid: 'tg:1', delta: toUnits(25), kind: 'grant', ref: 'g1' }]);
  assert.equal(await gw.resetPlayMoney(), 1);
  assert.equal(await store.balance('tg:1'), 0);
  assert.equal(await gw.resetPlayMoney(), 0);
  assert.equal((await store.ledgerOf('tg:1', 1))[0]!.kind, 'adjust');
});

test('a deposit with the right comment is credited exactly once and remembers the wallet', async () => {
  const { store, chain, gw } = await setup();
  const code = await gw.depositCode('tg:1');
  const from = rawAddr();
  const events: unknown[] = []; gw.on('deposit', (e) => events.push(e));
  const t = chain.deposit(from, 2.5, code.toLowerCase());   // comment case does not matter
  await gw.processIncoming(t);
  await gw.processIncoming(t);                               // seen again: nothing happens
  assert.equal(await store.balance('tg:1'), toUnits(2.5));
  assert.equal(events.length, 1);
  assert.deepEqual((await gw.info('tg:1')).addresses, [friendly(from)]);
});

test('unknown comments, tiny amounts and bounced transfers are not credited', async () => {
  const { store, chain, gw } = await setup();
  const code = await gw.depositCode('tg:1');
  await gw.processIncoming(chain.deposit(rawAddr(), 5, 'SOMETHING'));
  await gw.processIncoming(chain.deposit(rawAddr(), 0.01, code));
  await gw.processIncoming(chain.deposit(rawAddr(), 5, code, false));
  assert.equal(await store.balance('tg:1'), 0);
});

test('polling credits only transfers newer than the saved cursor', async () => {
  const { store, chain, gw } = await setup();
  const code = await gw.depositCode('tg:2');
  chain.deposit(rawAddr(), 1, code); chain.deposit(rawAddr(), 2, code);
  await gw.pollDeposits(); await gw.pollDeposits();
  chain.deposit(rawAddr(), 3, code);
  await gw.pollDeposits();
  assert.equal(await store.balance('tg:2'), toUnits(6));
});

test('withdrawals: only to a deposit wallet, within balance and the daily limit', async () => {
  const { store, chain, gw } = await setup();
  const code = await gw.depositCode('tg:1');
  const mine = rawAddr();
  await gw.processIncoming(chain.deposit(mine, 10, code));
  await assert.rejects(gw.requestWithdraw('tg:1', toUnits(1), friendly(rawAddr())), /deposited from/);
  await assert.rejects(gw.requestWithdraw('tg:1', toUnits(0.1), friendly(mine)), /minimum/);
  await assert.rejects(gw.requestWithdraw('tg:1', toUnits(50), friendly(mine)), /insufficient/);
  const r = await gw.requestWithdraw('tg:1', toUnits(4), friendly(mine));
  assert.equal(r.balance, toUnits(6));
  assert.equal(await store.balance('tg:1'), toUnits(6));
  const small = { ...config, ton: { ...config.ton, maxWithdrawDay: toUnits(5) } };
  const gw2 = new TonGateway(small, store.db, chain);
  await assert.rejects(gw2.requestWithdraw('tg:1', toUnits(2), friendly(mine)), /daily/);
});

test('a payout goes out once, even if the server restarts right after sending', async () => {
  const { chain, gw, store } = await setup();
  const code = await gw.depositCode('tg:1'); const mine = rawAddr();
  await gw.processIncoming(chain.deposit(mine, 10, code));
  const { id } = await gw.requestWithdraw('tg:1', toUnits(3), friendly(mine));
  await gw.processWithdrawals();                      // claims seqno 0 and sends
  assert.equal(chain.executed.length, 1);
  // "restart": a fresh gateway sees the payout still marked as sending
  const gw2 = new TonGateway(config, store.db, chain);
  await gw2.processWithdrawals();                     // seqno moved on -> marked sent, nothing resent
  await gw2.processWithdrawals();
  assert.equal(chain.executed.length, 1);
  assert.equal(chain.executed[0]!.nano, 3_000_000_000n);
  const row = await store.db.query('SELECT status FROM ton_withdrawals WHERE id = $1', [id]);
  assert.equal(row.rows[0].status, 'sent');
});

test('a payout that did not land is resent with the same seqno and paid once', async () => {
  const { chain, gw, store } = await setup();
  const code = await gw.depositCode('tg:1'); const mine = rawAddr();
  await gw.processIncoming(chain.deposit(mine, 10, code));
  await gw.requestWithdraw('tg:1', toUnits(2), friendly(mine));
  chain.stall = true;
  await gw.processWithdrawals();                       // sent, but the network dropped it
  await gw.processWithdrawals();                       // too early to resend
  assert.equal(chain.sends, 1);
  await store.db.query("UPDATE ton_withdrawals SET updated_at = now() - interval '2 minutes'");
  chain.stall = false;
  await gw.processWithdrawals();                       // resent with the same seqno -> executes
  await gw.processWithdrawals();                       // now confirmed
  assert.equal(chain.executed.length, 1);
  assert.equal(chain.executed[0]!.seqno, 0);
});

test('a payout that never lands is returned to the balance, only after the transfer surely expired', async () => {
  const { chain, gw, store } = await setup();
  const code = await gw.depositCode('tg:1'); const mine = rawAddr();
  await gw.processIncoming(chain.deposit(mine, 10, code));
  await gw.requestWithdraw('tg:1', toUnits(2), friendly(mine));
  chain.stall = true;
  await gw.processWithdrawals();
  await store.db.query("UPDATE ton_withdrawals SET attempts = 5, updated_at = now() - interval '90 seconds'");
  await gw.processWithdrawals();                       // 90 s: not yet, it might still land
  assert.equal(await store.balance('tg:1'), toUnits(8));
  await store.db.query("UPDATE ton_withdrawals SET updated_at = now() - interval '4 minutes'");
  await gw.processWithdrawals();
  assert.equal(await store.balance('tg:1'), toUnits(10));
  assert.equal(chain.executed.length, 0);
});

test('when the house wallet is low, payouts wait instead of failing', async () => {
  const { chain, gw, store } = await setup();
  const code = await gw.depositCode('tg:1'); const mine = rawAddr();
  await gw.processIncoming(chain.deposit(mine, 10, code));
  await gw.requestWithdraw('tg:1', toUnits(5), friendly(mine));
  chain.bal = 1_000_000_000n;
  await gw.processWithdrawals();
  const row = await store.db.query('SELECT status, error FROM ton_withdrawals');
  assert.equal(row.rows[0].status, 'pending');
  assert.match(row.rows[0].error, /low/);
  assert.equal(chain.sends, 0);
});
