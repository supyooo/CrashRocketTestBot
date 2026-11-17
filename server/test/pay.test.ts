/** USDT through Crypto Pay: deposits credited once, the support model's withdrawal rules, payouts that never pay twice. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import pg from 'pg';
import { config, toUnits } from '../src/config.js';
import { PgStore } from '../src/store/pg.js';
import { PayGateway } from '../src/pay/gateway.js';
import { verifyWebhook } from '../src/pay/cryptopay.js';
import { FakePay } from './fake-pay.js';
import { startPg } from './pg-helper.js';

let url = '', stop: () => Promise<void> = async () => {};
const opened: PgStore[] = [];
before(async () => { const p = await startPg(); url = p.url; stop = p.stop; });
after(async () => { for (const s of opened) await s.close().catch(() => {}); await stop(); });

const TOKEN = '1234:TESTTOKEN';
const cfg = { ...config, pay: { ...config.pay, enabled: true, token: TOKEN, network: 'testnet' as const, minDeposit: toUnits(10), minWithdraw: toUnits(10), maxWithdrawDay: toUnits(1000), wager: 2 },
  admin: { ...config.admin, reviewOver: toUnits(50) } };
let n = 0;
async function setup() {
  const name = 'pay_t' + ++n;
  const c = new pg.Client(url); await c.connect(); await c.query(`CREATE DATABASE ${name}`); await c.end();
  const store = await PgStore.open(url.replace(/\/crash$/, '/' + name)); opened.push(store);
  const api = new FakePay(), pay = new PayGateway(cfg, store.db, api);
  const events: { name: string; e: Record<string, unknown> }[] = [];
  for (const ev of ['deposit', 'withdraw', 'review', 'low']) pay.on(ev, (e) => events.push({ name: ev, e }));
  await store.putUser({ id: 'tg:1', name: 'Ann', tgId: 1, createdAt: Date.now() });
  await store.putUser({ id: 'dev:bob', name: 'bob', createdAt: Date.now() });
  /** Deposits `usdt` and pays it; returns the balance. */
  const deposit = async (usdt: number, uid = 'tg:1') => { const d = await pay.deposit(uid, toUnits(usdt)); api.pay(api.idOf(d.url)); await pay.pollInvoices(); return store.balance(uid); };
  /** Turnover for the wager: bets of 10 each won back at 1.00x, so the balance stays where it is. */
  let b = 0;
  const bet = async (usdt: number, uid = 'tg:1') => { for (let left = usdt; left > 0; left -= 10) { const ref = `bet:${++b}:${uid}:1`;
    await store.applyLedger([{ uid, delta: -toUnits(Math.min(10, left)), kind: 'bet', ref }]); await store.applyLedger([{ uid, delta: toUnits(Math.min(10, left)), kind: 'win', ref: 'win:' + ref }]); } };
  return { store, api, pay, events, deposit, bet };
}

test('old balances are zeroed once, with a ledger entry each', async () => {
  const { store, pay } = await setup();
  await store.applyLedger([{ uid: 'tg:1', delta: toUnits(25), kind: 'grant', ref: 'grant:start:tg:1' }]);
  assert.equal(await pay.resetBalances(), 1);
  assert.equal(await store.balance('tg:1'), 0);
  assert.equal(await pay.resetBalances(), 0);   // only once
  assert.equal((await store.ledgerOf('tg:1', 5))[0]!.ref, 'reset-usdt:tg:1');
});

test('a deposit is an invoice; paid, it is credited once, by webhook or by poll; expired, nothing', async () => {
  const { store, api, pay, events } = await setup();
  await assert.rejects(pay.deposit('tg:1', toUnits(9.99)), /minimum deposit/);
  await assert.rejects(pay.deposit('tg:1', toUnits(10.005)), /whole cents/);
  const d = await pay.deposit('tg:1', toUnits(25));
  assert.match(d.url, /CryptoTestnetBot/);
  await pay.pollInvoices();
  assert.equal(await store.balance('tg:1'), 0);                 // not paid yet
  const paid = api.pay(api.idOf(d.url));
  // the webhook: a wrong signature is refused, the right one credits
  const raw = JSON.stringify({ update_type: 'invoice_paid', payload: paid });
  assert.equal(await pay.webhook(raw, 'deadbeef'), false);
  const sig = createHmac('sha256', createHash('sha256').update(TOKEN).digest()).update(raw).digest('hex');
  assert.equal(verifyWebhook(TOKEN, raw, sig), true);
  assert.equal(await pay.webhook(raw, sig), true);
  assert.equal(await store.balance('tg:1'), toUnits(25));
  await pay.webhook(raw, sig); await pay.pollInvoices();         // again: nothing more
  assert.equal(await store.balance('tg:1'), toUnits(25));
  assert.equal(events.filter((e) => e.name === 'deposit').length, 1);
  const fee = await store.db.query('SELECT fee, status FROM pay_invoices WHERE id = $1', [d.id]);
  assert.deepEqual([Number(fee.rows[0].fee), fee.rows[0].status], [toUnits(0.3), 'paid']);
  const e = await pay.deposit('tg:1', toUnits(10));
  api.invoices.get(api.idOf(e.url))!.status = 'expired';
  await pay.pollInvoices();
  assert.equal(await store.balance('tg:1'), toUnits(25));
  assert.equal((await pay.info('tg:1')).history.filter((h) => h.kind === 'deposit').length, 1);   // the expired one is not listed
});

test('withdrawals: minimum, wager x2 of the deposits, review above 50, a dev account cannot', async () => {
  const { store, pay, events, deposit, bet } = await setup();
  await deposit(100);
  await assert.rejects(pay.requestWithdraw('tg:1', toUnits(5)), /minimum withdrawal/);
  await assert.rejects(pay.requestWithdraw('tg:1', toUnits(20)), /wager is not met/);
  await bet(150);
  let info = await pay.info('tg:1');
  assert.deepEqual([info.wager.need, info.wager.done, info.wager.met], [toUnits(200), toUnits(150), false]);
  await bet(50);
  info = await pay.info('tg:1');
  assert.equal(info.wager.met, true);
  const small = await pay.requestWithdraw('tg:1', toUnits(20));
  const big = await pay.requestWithdraw('tg:1', toUnits(60));
  assert.deepEqual([small.status, big.status], ['pending', 'review']);
  assert.equal(await store.balance('tg:1'), toUnits(100 - 20 - 60));
  assert.equal(events.filter((e) => e.name === 'review').length, 1);
  await assert.rejects(pay.requestWithdraw('tg:1', toUnits(900)), /insufficient/);
  await store.applyLedger([{ uid: 'dev:bob', delta: toUnits(50), kind: 'grant', ref: 'g:bob' }]);
  await assert.rejects(pay.requestWithdraw('dev:bob', toUnits(10)), /Telegram account/);
  // frozen: no withdrawals
  await store.db.query("INSERT INTO user_flags (user_id, frozen) VALUES ('tg:1', true)");
  await assert.rejects(pay.requestWithdraw('tg:1', toUnits(10)), /suspended/);
});

test('the player cancels a request until it is being sent; the money comes back once', async () => {
  const { store, pay, deposit, bet } = await setup();
  await deposit(100); await bet(200);
  const w = await pay.requestWithdraw('tg:1', toUnits(30));
  const before = await store.balance('tg:1');
  await pay.cancelWithdraw('tg:1', w.id);
  assert.equal(await store.balance('tg:1'), before + toUnits(30));
  await assert.rejects(pay.cancelWithdraw('tg:1', w.id), /no longer/);
  await assert.rejects(pay.cancelWithdraw('dev:bob', w.id), /no longer/);   // not someone else's
  const h = (await pay.info('tg:1')).history.find((x) => x.kind === 'withdraw')!;
  assert.deepEqual([h.status, 'cancel' in h && h.cancel], ['cancelled', false]);
});

test('payouts: a transfer to the CryptoBot wallet, never twice, even when the answer is lost or the server restarts', async () => {
  const { store, api, pay, deposit, bet } = await setup();
  await deposit(100); await bet(200);
  const a = await pay.requestWithdraw('tg:1', toUnits(20));
  await pay.processWithdrawals();
  assert.deepEqual(api.transfers.map((t) => [t.user_id, t.amount, t.spend_id]), [[1, '20.00', 'boomy-wd-' + a.id]]);
  assert.equal((await store.db.query('SELECT status FROM pay_withdrawals WHERE id = $1', [a.id])).rows[0].status, 'sent');
  // the transfer goes out but the answer is lost: the row stays 'sending'; next time it is found, not paid again
  const b = await pay.requestWithdraw('tg:1', toUnits(15));
  api.loseAnswer = true;
  await pay.processWithdrawals();
  await store.db.query("UPDATE pay_withdrawals SET status = 'sending' WHERE id = $1", [b.id]);   // as if the process died there
  await pay.processWithdrawals();
  assert.equal(api.transfers.filter((t) => t.spend_id === 'boomy-wd-' + b.id).length, 1);
  assert.equal((await store.db.query('SELECT status FROM pay_withdrawals WHERE id = $1', [b.id])).rows[0].status, 'sent');
});

test('a payout that cannot go out comes back; a short house balance waits instead', async () => {
  const { store, api, pay, events, deposit, bet } = await setup();
  await deposit(100); await bet(200);
  const start = await store.balance('tg:1');
  const a = await pay.requestWithdraw('tg:1', toUnits(20));
  api.failNext = 'INSUFFICIENT_FUNDS';
  await pay.processWithdrawals();
  const row = (await store.db.query('SELECT status, error FROM pay_withdrawals WHERE id = $1', [a.id])).rows[0];
  assert.deepEqual([row.status, row.error], ['pending', 'house balance is low']);
  assert.equal(events.filter((e) => e.name === 'low').length, 1);
  assert.equal(await store.balance('tg:1'), start - toUnits(20));   // the player loses nothing, it just waits
  await pay.processWithdrawals();
  assert.equal((await store.db.query('SELECT status FROM pay_withdrawals WHERE id = $1', [a.id])).rows[0].status, 'sent');
  // the player never opened CryptoBot: the money comes back with a reason
  const b = await pay.requestWithdraw('tg:1', toUnits(10));
  api.failNext = 'USER_NOT_FOUND';
  await pay.processWithdrawals();
  const rb = (await store.db.query('SELECT status, error FROM pay_withdrawals WHERE id = $1', [b.id])).rows[0];
  assert.equal(rb.status, 'failed'); assert.match(rb.error, /CryptoBot/);
  assert.equal(await store.balance('tg:1'), start - toUnits(20));
  assert.equal(await pay.houseBalance(), toUnits(1000));
});
