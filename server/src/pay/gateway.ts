/**
 * USDT payments through Crypto Pay (@CryptoBot). Testnet only in this build.
 *
 * Deposits: the player asks for an amount, the server opens an invoice and the player pays it in CryptoBot. A paid
 * invoice is credited once (the invoice row is locked and switched to 'paid' in the same transaction as the ledger
 * entry), whether the news comes by webhook or by the poll that backs it up.
 *
 * Withdrawals (the support model's rules): from the minimum, only after the turnover reaches `wager` times the
 * deposits, never from a blocked or frozen account; the money leaves the balance when the request is made. Up to
 * `reviewOver` they go straight to the payout queue, above it they wait for an admin. The player can cancel a
 * request until it is being sent. Payouts go one at a time as transfers to the player's CryptoBot wallet; each has
 * the spend_id `boomy-wd-<id>`, so a transfer can never be paid twice, and one interrupted by a restart is looked up
 * before it is tried again. A payout that cannot go out (the player never opened CryptoBot, or it keeps failing)
 * comes back to the balance.
 */
import { EventEmitter } from 'node:events';
import type pg from 'pg';
import type { Config } from '../config.js';
import { fromUnits, toUnits } from '../config.js';
import { InsufficientFunds } from '../store/store.js';
import { CryptoPayError, verifyWebhook, type Invoice, type PayApi } from './cryptopay.js';

export class PayError extends Error {}
type Tx = pg.PoolClient;
const ASSET = 'USDT';
const INVOICE_TTL_S = 3600;
const GIVE_UP_AFTER = 8;                       // tries of one payout before it comes back to the balance
const usd = (units: number) => (Math.round(units / 10_000) / 100).toFixed(2);   // units -> "12.34"

/** Turnover against `times` x all deposits (bets after the first deposit, minus refunded bets). */
export async function wagerOf(db: pg.Pool | Tx, uid: string, times: number) {
  const dep = await db.query("SELECT min(id) AS first, coalesce(sum(delta), 0) AS s FROM ledger WHERE user_id = $1 AND kind = 'deposit'", [uid]);
  const deposits = Number(dep.rows[0].s), first = dep.rows[0].first;
  if (!first) return { deposits: 0, need: 0, done: 0, met: true };
  const t = await db.query(`SELECT coalesce(sum(-delta) FILTER (WHERE kind = 'bet'), 0) - coalesce(sum(delta) FILTER (WHERE kind = 'refund' AND ref ~ '^(cancel|late|restart|admrefund):bet:'), 0) AS s
    FROM ledger WHERE user_id = $1 AND id > $2`, [uid, first]);
  const need = Math.round(deposits * times), done = Number(t.rows[0].s);
  return { deposits, need, done, met: done >= need };
}

export class PayGateway extends EventEmitter {
  private busyInv = false;
  private busyWd = false;
  private timers: NodeJS.Timeout[] = [];

  constructor(private cfg: Config, private db: pg.Pool, private api: PayApi) { super(); }

  /* ---------------- helpers ---------------- */
  private async tx<T>(fn: (c: Tx) => Promise<T>): Promise<T> {
    const c = await this.db.connect();
    try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
    catch (err) { await c.query('ROLLBACK'); throw err; } finally { c.release(); }
  }
  /** Balance move inside an open transaction, same rules as the store: never below zero, unique ref. */
  private async move(c: Tx, uid: string, delta: number, kind: string, ref: string): Promise<number> {
    await c.query('INSERT INTO accounts (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [uid]);
    const u = await c.query('UPDATE accounts SET balance = balance + $2 WHERE user_id = $1 AND balance + $2 >= 0 RETURNING balance', [uid, delta]);
    if (!u.rows.length) throw new InsufficientFunds('insufficient funds');
    await c.query('INSERT INTO ledger (user_id, delta, balance, kind, ref) VALUES ($1,$2,$3,$4,$5)', [uid, delta, u.rows[0].balance, kind, ref]);
    return Number(u.rows[0].balance);
  }
  /** An amount the player typed, in units: whole cents only. */
  private cents(amount: number): number {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount % 10_000 !== 0) throw new PayError('amount must be in whole cents');
    return amount;
  }

  /* ---------------- switching to USDT ---------------- */
  /** Every balance left from play money or test TON is zeroed once, with a ledger entry each, before USDT starts. */
  async resetBalances(): Promise<number> {
    return this.tx(async (c) => {
      const done = await c.query("SELECT 1 FROM kv WHERE key = 'currency' AND value = '\"usdt\"'::jsonb");
      if (done.rows.length) return 0;
      const { rows } = await c.query('SELECT user_id, balance FROM accounts WHERE balance > 0 FOR UPDATE');
      for (const r of rows) await this.move(c, r.user_id, -Number(r.balance), 'adjust', 'reset-usdt:' + r.user_id);
      await c.query("INSERT INTO kv (key, value) VALUES ('currency', '\"usdt\"'::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value");
      return rows.length;
    });
  }

  /* ---------------- the player's view ---------------- */
  async info(uid: string) {
    const P = this.cfg.pay;
    const [inv, wds, w] = await Promise.all([
      this.db.query("SELECT id, amount, status, url, created_at, paid_at FROM pay_invoices WHERE user_id = $1 AND status IN ('active', 'paid') ORDER BY id DESC LIMIT 30", [uid]),
      this.db.query('SELECT id, amount, status, error, created_at, updated_at FROM pay_withdrawals WHERE user_id = $1 ORDER BY id DESC LIMIT 30', [uid]),
      wagerOf(this.db, uid, P.wager)
    ]);
    return {
      asset: ASSET, network: P.network, minDeposit: P.minDeposit, minWithdraw: P.minWithdraw, maxWithdrawDay: P.maxWithdrawDay, reviewOver: this.cfg.admin.reviewOver, wager: w,
      history: [
        ...inv.rows.map((r) => ({ kind: 'deposit', id: Number(r.id), amount: Number(r.amount), status: r.status, at: r.created_at.getTime(), url: r.status === 'active' ? r.url : undefined })),
        ...wds.rows.map((r) => ({ kind: 'withdraw', id: Number(r.id), amount: Number(r.amount), status: r.status, at: r.created_at.getTime(), error: r.error ?? undefined,
          cancel: r.status === 'review' || r.status === 'pending' }))
      ].sort((a, b) => b.at - a.at).slice(0, 30)
    };
  }

  /* ---------------- deposits ---------------- */
  /** Opens an invoice for the player; returns the link that opens it in CryptoBot. */
  async deposit(uid: string, amount: number): Promise<{ id: number; url: string }> {
    this.cents(amount);
    if (amount < this.cfg.pay.minDeposit) throw new PayError('amount is below the minimum deposit');
    const open = await this.db.query("SELECT count(*)::int AS n FROM pay_invoices WHERE user_id = $1 AND status = 'active'", [uid]);
    if (open.rows[0].n >= 5) throw new PayError('too many unpaid deposits, pay or wait for one to expire');
    const row = await this.db.query("INSERT INTO pay_invoices (user_id, amount, status) VALUES ($1, $2, 'creating') RETURNING id", [uid, amount]);
    const id = Number(row.rows[0].id);
    let inv: Invoice;
    try { inv = await this.api.createInvoice({ asset: ASSET, amount: usd(amount), description: `Boomy: пополнение #${id}`, payload: 'dep:' + id, expiresIn: INVOICE_TTL_S }); }
    catch (err) { await this.db.query("UPDATE pay_invoices SET status = 'failed' WHERE id = $1", [id]); throw new PayError('the payment service is not available, try again in a minute'); }
    const url = inv.mini_app_invoice_url || inv.bot_invoice_url;
    await this.db.query("UPDATE pay_invoices SET invoice_id = $2, url = $3, status = 'active' WHERE id = $1", [id, inv.invoice_id, url]);
    return { id, url };
  }

  /** Applies what Crypto Pay says about an invoice: a paid one is credited once, an expired one is closed. */
  async settleInvoice(inv: Invoice): Promise<void> {
    if (inv.status === 'active') return;
    const res = await this.tx(async (c) => {
      const r = await c.query("SELECT id, user_id, amount FROM pay_invoices WHERE invoice_id = $1 AND status = 'active' FOR UPDATE", [inv.invoice_id]);
      const row = r.rows[0];
      if (!row) return null;                                   // not ours, or already settled
      if (inv.status === 'expired') { await c.query("UPDATE pay_invoices SET status = 'expired' WHERE id = $1", [row.id]); return null; }
      if ((inv.asset ?? ASSET) !== ASSET || toUnits(Number(inv.amount)) !== Number(row.amount)) {
        await c.query("UPDATE pay_invoices SET status = 'failed' WHERE id = $1", [row.id]);
        console.error(`pay: invoice ${inv.invoice_id} does not match its request, not credited`);
        return null;
      }
      const fee = inv.fee_amount ? toUnits(Number(inv.fee_amount)) : null;
      await c.query("UPDATE pay_invoices SET status = 'paid', paid_at = now(), fee = $2 WHERE id = $1", [row.id, fee]);
      const balance = await this.move(c, row.user_id, Number(row.amount), 'deposit', 'dep:' + inv.invoice_id);
      return { uid: row.user_id as string, amount: Number(row.amount), balance };
    });
    if (res) this.emit('deposit', res);
  }

  /** A webhook call from Crypto Pay; false when its signature is wrong. */
  async webhook(raw: string, signature: string | undefined): Promise<boolean> {
    if (!verifyWebhook(this.cfg.pay.token, raw, signature)) return false;
    const u = JSON.parse(raw) as { update_type?: string; payload?: Invoice };
    if (u.update_type === 'invoice_paid' && u.payload) await this.settleInvoice(u.payload);
    return true;
  }

  /** The backup of the webhook: asks about every invoice still open. */
  async pollInvoices(): Promise<void> {
    if (this.busyInv) return;
    this.busyInv = true;
    try {
      const { rows } = await this.db.query("SELECT invoice_id FROM pay_invoices WHERE status = 'active' AND invoice_id IS NOT NULL ORDER BY id LIMIT 100");
      if (!rows.length) return;
      for (const inv of await this.api.getInvoices(rows.map((r) => Number(r.invoice_id)))) await this.settleInvoice(inv);
    } finally { this.busyInv = false; }
  }

  /* ---------------- withdrawals ---------------- */
  async requestWithdraw(uid: string, amount: number): Promise<{ id: number; status: string; balance: number }> {
    const P = this.cfg.pay;
    this.cents(amount);
    if (amount < P.minWithdraw) throw new PayError('amount is below the minimum withdrawal');
    const r = await this.tx(async (c) => {
      const user = await c.query('SELECT tg_id FROM users WHERE id = $1', [uid]);
      const tg = user.rows[0]?.tg_id;
      if (!tg) throw new PayError('withdrawals need a Telegram account');
      const fl = await c.query('SELECT blocked, frozen FROM user_flags WHERE user_id = $1', [uid]);
      if (fl.rows[0]?.blocked || fl.rows[0]?.frozen) throw new PayError('withdrawals are suspended for this account, contact support');
      await c.query('SELECT 1 FROM accounts WHERE user_id = $1 FOR UPDATE', [uid]);   // one request at a time per player
      const w = await wagerOf(c, uid, P.wager);
      if (!w.met) throw new PayError('wager is not met');
      if (P.maxWithdrawDay > 0) {
        const day = await c.query("SELECT coalesce(sum(amount), 0) AS s FROM pay_withdrawals WHERE user_id = $1 AND status NOT IN ('failed', 'rejected', 'cancelled') AND created_at >= date_trunc('day', now())", [uid]);
        if (Number(day.rows[0].s) + amount > P.maxWithdrawDay) throw new PayError('daily withdrawal limit reached');
      }
      const status = amount > this.cfg.admin.reviewOver ? 'review' : 'pending';
      const ins = await c.query('INSERT INTO pay_withdrawals (user_id, tg_id, amount, status) VALUES ($1, $2, $3, $4) RETURNING id', [uid, tg, amount, status]);
      const id = Number(ins.rows[0].id);
      const balance = await this.move(c, uid, -amount, 'withdraw', 'wd:' + id);
      return { id, status, balance };
    });
    this.emit('withdraw', { uid, id: r.id, status: r.status, amount, balance: r.balance });
    if (r.status === 'review') this.emit('review', { uid, id: r.id, amount });
    return r;
  }

  /** The player takes a request back while it waits for review or for its turn. */
  async cancelWithdraw(uid: string, id: number): Promise<{ balance: number }> {
    const r = await this.tx(async (c) => {
      const u = await c.query("UPDATE pay_withdrawals SET status = 'cancelled', updated_at = now() WHERE id = $1 AND user_id = $2 AND status IN ('review', 'pending') RETURNING amount", [id, uid]);
      if (!u.rows.length) throw new PayError('this withdrawal can no longer be cancelled');
      const amount = Number(u.rows[0].amount);
      return { amount, balance: await this.move(c, uid, amount, 'refund', 'wdc:' + id) };
    });
    this.emit('withdraw', { uid, id, status: 'cancelled', amount: r.amount, balance: r.balance });
    return { balance: r.balance };
  }

  /** An admin lets a withdrawal under review go to the payout queue. */
  async approve(id: number): Promise<{ uid: string; amount: number }> {
    const u = await this.db.query("UPDATE pay_withdrawals SET status = 'pending', updated_at = now() WHERE id = $1 AND status = 'review' RETURNING user_id, amount", [id]);
    if (!u.rows.length) throw new PayError('this withdrawal is not waiting for review');
    const r = { uid: u.rows[0].user_id as string, amount: Number(u.rows[0].amount) };
    this.emit('withdraw', { uid: r.uid, id, status: 'pending', amount: r.amount });
    return r;
  }

  /** An admin turns a withdrawal down: the money goes back to the balance. */
  async reject(id: number, why: string): Promise<{ uid: string; amount: number }> {
    const r = await this.tx(async (c) => {
      const u = await c.query("UPDATE pay_withdrawals SET status = 'rejected', error = $2, updated_at = now() WHERE id = $1 AND status IN ('review', 'pending') RETURNING user_id, amount", [id, why.slice(0, 200)]);
      if (!u.rows.length) throw new PayError('this withdrawal can no longer be rejected');
      const uid = u.rows[0].user_id as string, amount = Number(u.rows[0].amount);
      return { uid, amount, balance: await this.move(c, uid, amount, 'refund', 'wdr:' + id) };
    });
    this.emit('withdraw', { uid: r.uid, id, status: 'rejected', amount: r.amount, balance: r.balance });
    return { uid: r.uid, amount: r.amount };
  }

  /** The app's USDT in Crypto Pay, in units. */
  async houseBalance(): Promise<number> { return toUnits(Number(await this.api.balance(ASSET))); }

  /** Moves the payout queue one step: one payout at a time. */
  async processWithdrawals(): Promise<void> {
    if (this.busyWd) return;
    this.busyWd = true;
    try {
      // a payout interrupted by a restart: find it at Crypto Pay before trying again
      const stuck = (await this.db.query("SELECT * FROM pay_withdrawals WHERE status = 'sending' ORDER BY id LIMIT 1")).rows[0];
      if (stuck) {
        const found = await this.api.getTransfers('boomy-wd-' + stuck.id);
        if (found.length) await this.sent(stuck, found[0]!.transfer_id);
        else await this.db.query("UPDATE pay_withdrawals SET status = 'pending', updated_at = now() WHERE id = $1 AND status = 'sending'", [stuck.id]);
        return;
      }
      const w = (await this.db.query("SELECT * FROM pay_withdrawals WHERE status = 'pending' AND updated_at < now() - (attempts * interval '20 seconds') ORDER BY id LIMIT 1")).rows[0];
      if (!w) return;
      const claimed = await this.db.query("UPDATE pay_withdrawals SET status = 'sending', attempts = attempts + 1, updated_at = now() WHERE id = $1 AND status = 'pending' RETURNING id", [w.id]);
      if (!claimed.rows.length) return;
      this.emit('withdraw', { uid: w.user_id, id: Number(w.id), status: 'sending', amount: Number(w.amount) });
      try {
        const t = await this.api.transfer({ userId: Number(w.tg_id), asset: ASSET, amount: usd(Number(w.amount)), spendId: 'boomy-wd-' + w.id, comment: `Boomy: вывод #${w.id}` });
        await this.sent(w, t.transfer_id);
      } catch (err) {
        const name = err instanceof CryptoPayError ? err.name : 'NETWORK';
        if (/USER_NOT_FOUND|USER_BLOCKED|NOT_STARTED/i.test(name)) return void (await this.fail(w, 'open @CryptoBot once, then request the withdrawal again'));
        if (/SPEND_ID/i.test(name)) {                       // it went out already under this spend_id
          const found = await this.api.getTransfers('boomy-wd-' + w.id).catch(() => []);
          if (found.length) return void (await this.sent(w, found[0]!.transfer_id));
        }
        const low = /INSUFFICIENT|NOT_ENOUGH/i.test(name);
        if (!low && w.attempts + 1 >= GIVE_UP_AFTER) return void (await this.fail(w, name));
        // the house is short of USDT, or a passing error: back in the queue, the player loses nothing
        await this.db.query("UPDATE pay_withdrawals SET status = 'pending', error = $2, attempts = CASE WHEN $3 THEN 0 ELSE attempts END, updated_at = now() WHERE id = $1",
          [w.id, low ? 'house balance is low' : name, low]);
        if (low) this.emit('low', { id: Number(w.id), amount: Number(w.amount) });
        else console.error(`pay: payout #${w.id} failed (${name}), will retry`);
      }
    } finally { this.busyWd = false; }
  }

  private async sent(w: { id: string; user_id: string; amount: string }, transferId: number) {
    await this.db.query("UPDATE pay_withdrawals SET status = 'sent', transfer_id = $2, error = NULL, updated_at = now() WHERE id = $1", [w.id, transferId]);
    this.emit('withdraw', { uid: w.user_id, id: Number(w.id), status: 'sent', amount: Number(w.amount) });
  }
  private async fail(w: { id: string; user_id: string; amount: string }, why: string) {
    const balance = await this.tx(async (c) => {
      const u = await c.query("UPDATE pay_withdrawals SET status = 'failed', error = $2, updated_at = now() WHERE id = $1 AND status = 'sending' RETURNING id", [w.id, why]);
      if (!u.rows.length) return null;
      return this.move(c, w.user_id, Number(w.amount), 'refund', 'wdf:' + w.id);
    });
    if (balance !== null) this.emit('withdraw', { uid: w.user_id, id: Number(w.id), status: 'failed', amount: Number(w.amount), balance, error: why });
  }

  start() {
    const safe = (fn: () => Promise<void>, what: string) => () => void fn().catch((err) => console.error(`pay ${what}:`, err.message));
    this.timers.push(setInterval(safe(() => this.pollInvoices(), 'invoices'), this.cfg.pay.pollMs));
    this.timers.push(setInterval(safe(() => this.processWithdrawals(), 'withdrawals'), 3000));
  }
  stop() { this.timers.forEach(clearInterval); this.timers = []; }
}

export const amountText = (units: number) => fromUnits(units).toFixed(2);
