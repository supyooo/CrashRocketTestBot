/** Admin panel: Telegram login check, withdrawal review, matching deposits by hand, balance corrections, flags, reports. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import pg from 'pg';
import { config, toUnits } from '../src/config.js';
import { PgStore } from '../src/store/pg.js';
import { TonGateway } from '../src/ton/gateway.js';
import { Admin } from '../src/admin/admin.js';
import { AuthError, signLoginWidget, validateLoginWidget } from '../src/auth/telegram.js';
import type { InTx, TonChain } from '../src/ton/chain.js';
import { startPg } from './pg-helper.js';

const rawAddr = () => '0:' + randomBytes(32).toString('hex');
class FakeChain implements TonChain {
  house = rawAddr(); seq = 0; bal = 1_000_000_000_000n; txs: InTx[] = [];
  async seqno() { return this.seq; }
  async balance() { return this.bal; }
  async incoming(limit: number) { return [...this.txs].reverse().slice(0, limit); }
  async send() { this.seq++; }
  deposit(from: string, ton: number, comment: string): InTx {
    const t = { hash: randomBytes(32).toString('hex'), lt: String(1000 + this.txs.length), source: from, nano: BigInt(Math.round(ton * 1e9)), comment, ok: true };
    this.txs.push(t); return t;
  }
}

const BOT = '123456:TEST-token';
const cfg = { ...config, botToken: BOT, devAuth: false, admin: { ...config.admin, ids: ['777'], reviewOver: toUnits(50) } };
let url = '', stop: () => Promise<void> = async () => {};
const opened: PgStore[] = [], servers: Server[] = [];
before(async () => { const p = await startPg(); url = p.url; stop = p.stop; });
after(async () => { for (const s of servers) s.close(); for (const s of opened) await s.close().catch(() => {}); await stop(); });

let n = 0;
async function setup() {
  const name = 'adm_t' + ++n;
  const c = new pg.Client(url); await c.connect(); await c.query(`CREATE DATABASE ${name}`); await c.end();
  const store = await PgStore.open(url.replace(/\/crash$/, '/' + name)); opened.push(store);
  const chain = new FakeChain();
  const ton = new TonGateway(cfg, store.db, chain);
  const admin = new Admin({ cfg, db: store.db, ref: { engine: null }, ton, online: () => 3 });
  for (const id of ['tg:1', 'tg:2']) await store.putUser({ id, name: id, tgId: Number(id.slice(3)), createdAt: Date.now() });
  // tg:1 deposits 100 TON from a wallet of their own
  const from = rawAddr();
  await ton.processIncoming(chain.deposit(from, 100, await ton.depositCode('tg:1')));
  return { store, chain, ton, admin, from };
}
/** A tiny server in front of the admin module, to call it the way the panel does. */
async function serve(admin: Admin) {
  const srv = createServer(async (req, res) => { if (!(await admin.handle(req, res, new URL(req.url ?? '/', 'http://x')))) res.writeHead(404).end(); });
  servers.push(srv);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(srv.address() as { port: number }).port}/admin/api`;
  let token = '';
  const call = async (path: string, body?: object) => {
    const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: (await r.json()) as Record<string, any> };
  };
  return { call, setToken: (t: string) => { token = t; } };
}
const widget = (id: string) => signLoginWidget({ id, first_name: 'Ann', username: 'ann', auth_date: String(Math.floor(Date.now() / 1000)) }, BOT);

test('login widget data is checked with the bot token', () => {
  const d = widget('777');
  assert.equal(validateLoginWidget(d, BOT).id, 777);
  assert.throws(() => validateLoginWidget({ ...d, id: '778' }, BOT), AuthError);
  assert.throws(() => validateLoginWidget(d, 'other:token'), AuthError);
  const old = signLoginWidget({ id: '777', auth_date: String(Math.floor(Date.now() / 1000) - 3 * 24 * 3600) }, BOT);
  assert.throws(() => validateLoginWidget(old, BOT), /expired/);
});

test('only listed admins get in, and a player session does not open the panel', async () => {
  const { admin } = await setup();
  const { call, setToken } = await serve(admin);
  assert.equal((await call('/login', widget('555'))).status, 401);
  assert.equal((await call('/summary')).status, 401);
  const ok = await call('/login', widget('777'));
  assert.equal(ok.status, 200);
  setToken(ok.json.token);
  assert.equal((await call('/me')).json.uid, 'tg:777');
});

test('a large withdrawal waits for review; reject refunds it, approve sends it to the payout queue', async () => {
  const { store, ton, admin, from } = await setup();
  const { call, setToken } = await serve(admin);
  setToken((await call('/login', widget('777'))).json.token);
  const { friendly } = await import('../src/ton/chain.js');
  const small = await ton.requestWithdraw('tg:1', toUnits(10), friendly(from));
  const big = await ton.requestWithdraw('tg:1', toUnits(60), friendly(from));
  assert.equal(await store.balance('tg:1'), toUnits(30));
  const q = (await call('/queue')).json as unknown as { id: number; wager: { met: boolean; need: number } }[];
  assert.deepEqual(q.map((w) => w.id), [big.id]);                  // the small one went straight to the payout queue
  assert.equal(q[0]!.wager.met, false); assert.equal(q[0]!.wager.need, 200);
  assert.equal((await call('/withdrawals/reject', { id: big.id })).status, 400);  // a reason is required
  assert.equal((await call('/withdrawals/reject', { id: big.id, reason: 'wager not met' })).status, 200);
  assert.equal(await store.balance('tg:1'), toUnits(90));
  assert.equal((await call('/withdrawals/reject', { id: big.id, reason: 'again' })).status, 400); // only once
  const big2 = await ton.requestWithdraw('tg:1', toUnits(55), friendly(from));
  assert.equal((await call('/withdrawals/approve', { id: big2.id })).status, 200);
  const st = await store.db.query('SELECT status FROM ton_withdrawals WHERE id = $1', [big2.id]);
  assert.equal(st.rows[0].status, 'pending');
  const card = (await call('/player?q=1')).json;
  assert.deepEqual(card.log.map((l: { action: string }) => l.action), ['approve', 'reject']);
});

test('a deposit without a code is credited by hand once', async () => {
  const { store, chain, ton, admin } = await setup();
  const { call, setToken } = await serve(admin);
  setToken((await call('/login', widget('777'))).json.token);
  const t = chain.deposit(rawAddr(), 5, 'oops');
  await ton.processIncoming(t);
  assert.equal((await call('/alerts')).json.unmatched.length, 1);
  assert.equal((await call('/deposits/attach', { tx: t.hash, uid: '2' })).status, 200);   // found by Telegram id
  assert.equal(await store.balance('tg:2'), toUnits(5));
  assert.equal((await call('/deposits/attach', { tx: t.hash, uid: '2' })).status, 400);
  assert.equal((await call('/alerts')).json.unmatched.length, 0);
});

test('corrections need a reason, block stops play and withdrawals, reports add up', async () => {
  const { store, admin, ton, from } = await setup();
  const { call, setToken } = await serve(admin);
  setToken((await call('/login', widget('777'))).json.token);
  assert.equal((await call('/player/action', { uid: 'tg:2', action: 'adjust', amount: 3 })).status, 400);
  assert.equal((await call('/player/action', { uid: 'tg:2', action: 'adjust', amount: 3, reason: 'compensation' })).status, 200);
  assert.equal(await store.balance('tg:2'), toUnits(3));
  assert.equal((await call('/player/action', { uid: 'tg:2', action: 'adjust', amount: -5, reason: 'too much' })).status, 400); // never below zero
  // a lost bet and a won bet for tg:1
  await store.applyLedger([{ uid: 'tg:1', delta: -toUnits(10), kind: 'bet', ref: 'bet:1:tg:1:1' }]);
  await store.applyLedger([{ uid: 'tg:1', delta: -toUnits(10), kind: 'bet', ref: 'bet:2:tg:1:2' }]);
  await store.applyLedger([{ uid: 'tg:1', delta: toUnits(25), kind: 'win', ref: 'win:bet:2:tg:1:2' }]);
  const s = (await call('/summary?period=today')).json;
  assert.equal(s.turnover, 20); assert.equal(s.wins, 25); assert.equal(s.ggr, -5); assert.equal(s.deposits, 100); assert.equal(s.bonuses, 3); assert.equal(s.online, 3);
  const card = (await call('/player?q=tg:1')).json;
  assert.equal(card.turnover, 20); assert.equal(card.losses, 10); assert.equal(card.income, -5);
  assert.deepEqual(card.lists.bets.map((b: { result: string }) => b.result), ['win', 'lose']);
  assert.equal((await call('/player/action', { uid: 'tg:1', action: 'refund_bet', ref: 'bet:1:tg:1:1', reason: 'lag' })).status, 200);
  assert.equal((await call('/player/action', { uid: 'tg:1', action: 'refund_bet', ref: 'bet:1:tg:1:1', reason: 'lag' })).status, 400);
  assert.equal((await call('/player/action', { uid: 'tg:1', action: 'refund_bet', ref: 'bet:2:tg:1:2', reason: 'x' })).status, 400); // a won bet
  await call('/player/action', { uid: 'tg:1', action: 'block', reason: 'bots' });
  assert.equal(admin.isBlocked('tg:1'), true);
  const { friendly } = await import('../src/ton/chain.js');
  await assert.rejects(ton.requestWithdraw('tg:1', toUnits(1), friendly(from)), /suspended/);
  await call('/player/action', { uid: 'tg:1', action: 'unblock' });
  assert.equal(admin.isBlocked('tg:1'), false);
  await call('/player/action', { uid: 'tg:1', action: 'note', text: 'wrote to support about lag' });
  assert.equal((await call('/player?q=tg:1')).json.log[0].action, 'note');
});

test('the same IP on two accounts shows up as an alert', async () => {
  const { admin } = await setup();
  const req = (ip: string) => ({ headers: { 'x-forwarded-for': ip }, socket: {} }) as never;
  await admin.recordLogin('tg:1', req('10.0.0.7'));
  await admin.recordLogin('tg:2', req('10.0.0.7, 172.16.0.1'));
  const { call, setToken } = await serve(admin);
  setToken((await call('/login', widget('777'))).json.token);
  const f = (await call('/alerts')).json.fraud;
  assert.deepEqual(f, [{ kind: 'ip', key: '10.0.0.7', users: ['tg:1', 'tg:2'] }]);
});
