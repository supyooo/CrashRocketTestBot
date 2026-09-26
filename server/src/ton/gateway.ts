/**
 * TON gateway (test TON only).
 *
 * Deposits: a player sends TON to the house wallet with their personal comment (deposit code). The gateway
 * polls the house wallet; each incoming transfer is recorded once by its hash and, in the same database
 * transaction, credited to the player and remembered as one of their wallets.
 *
 * Withdrawals: only to a wallet the player has deposited from (the deposit proves they own it). The request
 * takes the money from the balance and queues the payout in one transaction. One payout is sent at a time:
 * its wallet seqno is saved before sending, and a transfer with an already used seqno is rejected by the
 * wallet contract itself, so resending after a crash can never pay twice. Payouts that cannot go out are
 * returned to the balance.
 */
import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import type { Config } from '../config.js';
import { NANO_PER_UNIT } from '../config.js';
import { InsufficientFunds } from '../store/store.js';
import { commentPayload, friendly, parseTestnetAddress, type InTx, type TonChain } from './chain.js';

export class TonError extends Error {}

const FEE_RESERVE = 50_000_000n;          // 0.05 TON kept for the house wallet's own fees
const RESEND_AFTER_MS = 60_000;          // a transfer not seen on chain after this is sent again (same seqno)
const GIVE_UP_AFTER = 5;                 // then the payout fails and goes back to the balance…
const FINAL_WAIT_MS = 180_000;           // …but only this long after the last attempt: a sent transfer expires after 60 s, and
                                         // toncenter may lag a little, so by then an unseen payout can no longer land

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
function newCode() { const b = randomBytes(6); let s = 'CR'; for (const x of b) s += CODE_ALPHABET[x % CODE_ALPHABET.length]; return s; }

type Tx = pg.PoolClient;

export class TonGateway extends EventEmitter {
  private busyDep = false;
  private busyWd = false;
  private timers: NodeJS.Timeout[] = [];

  constructor(private cfg: Config, private db: pg.Pool, private chain: TonChain) { super(); }

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

  /* ---------------- one-time switch from play money ---------------- */
  /** Old play-money balances are zeroed once, with a ledger entry each, before test TON starts. */
  async resetPlayMoney(): Promise<number> {
    return this.tx(async (c) => {
      const done = await c.query("SELECT 1 FROM kv WHERE key = 'currency' AND value = '\"tton\"'::jsonb");
      if (done.rows.length) return 0;
      const { rows } = await c.query('SELECT user_id, balance FROM accounts WHERE balance > 0 FOR UPDATE');
      for (const r of rows) await this.move(c, r.user_id, -Number(r.balance), 'adjust', 'reset-play:' + r.user_id);
      await c.query("INSERT INTO kv (key, value) VALUES ('currency', '\"tton\"'::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value");
      return rows.length;
    });
  }

  /* ---------------- player info ---------------- */
  async depositCode(uid: string): Promise<string> {
    for (;;) {
      const got = await this.db.query('SELECT deposit_code FROM ton_accounts WHERE user_id = $1', [uid]);
      if (got.rows.length) return got.rows[0].deposit_code;
      try { await this.db.query('INSERT INTO ton_accounts (user_id, deposit_code) VALUES ($1, $2)', [uid, newCode()]); }
      catch (err) { if ((err as { code?: string }).code !== '23505') throw err; } // code clash or parallel insert: read again
    }
  }

  async info(uid: string) {
    const code = await this.depositCode(uid);
    const acc = await this.db.query('SELECT addresses FROM ton_accounts WHERE user_id = $1', [uid]);
    const deps = await this.db.query("SELECT tx_hash, nano, status, at FROM ton_deposits WHERE user_id = $1 ORDER BY at DESC LIMIT 10", [uid]);
    const wds = await this.db.query('SELECT id, amount, address, status, created_at FROM ton_withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [uid]);
    const units = (n: bigint) => Number(n / NANO_PER_UNIT);
    return {
      network: 'testnet', house: friendly(this.chain.house), code, payload: commentPayload(code),
      minDeposit: this.cfg.ton.minDeposit, minWithdraw: this.cfg.ton.minWithdraw, maxWithdrawDay: this.cfg.ton.maxWithdrawDay,
      addresses: (acc.rows[0]?.addresses ?? []).map(friendly),
      transfers: [
        ...deps.rows.map((d) => ({ kind: 'deposit', amount: units(BigInt(d.nano)), status: d.status, at: d.at.getTime(), tx: d.tx_hash })),
        ...wds.rows.map((w) => ({ kind: 'withdraw', id: Number(w.id), amount: Number(w.amount), status: w.status, at: w.created_at.getTime(), to: friendly(w.address) }))
      ].sort((a, b) => b.at - a.at).slice(0, 10)
    };
  }

  /* ---------------- deposits ---------------- */
  /** Records one incoming transfer; credits it if the comment is a player's code. Safe to call twice. */
  async processIncoming(t: InTx): Promise<void> {
    if (!t.ok || t.nano <= 0n) return;
    const res = await this.tx(async (c) => {
      const code = t.comment.toUpperCase().replace(/\s+/g, '');
      const owner = code ? await c.query('SELECT user_id FROM ton_accounts WHERE deposit_code = $1', [code]) : { rows: [] as { user_id: string }[] };
      const uid: string | undefined = owner.rows[0]?.user_id;
      const units = Number(t.nano / NANO_PER_UNIT);
      const status = !uid ? 'unmatched' : units < this.cfg.ton.minDeposit ? 'too_small' : 'credited';
      const ins = await c.query('INSERT INTO ton_deposits (tx_hash, lt, user_id, source, nano, comment, status) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tx_hash) DO NOTHING RETURNING tx_hash',
        [t.hash, t.lt, uid ?? null, t.source, t.nano.toString(), t.comment.slice(0, 120), status]);
      if (!ins.rows.length || status !== 'credited') return null; // already seen, or nothing to credit
      const balance = await this.move(c, uid!, units, 'deposit', 'dep:' + t.hash);
      await c.query('UPDATE ton_accounts SET addresses = array_append(addresses, $2) WHERE user_id = $1 AND NOT ($2 = ANY(addresses))', [uid, t.source]);
      return { uid: uid!, amount: units, balance };
    });
    if (res) this.emit('deposit', res);
  }

  async pollDeposits(): Promise<void> {
    if (this.busyDep) return;
    this.busyDep = true;
    try {
      const cur = await this.db.query("SELECT value FROM kv WHERE key = 'ton_cursor'");
      const lastLt = BigInt(cur.rows[0]?.value?.lt ?? '0');
      const txs = (await this.chain.incoming(50)).filter((t) => BigInt(t.lt) > lastLt).reverse(); // oldest first
      for (const t of txs) await this.processIncoming(t);
      if (txs.length) await this.db.query("INSERT INTO kv (key, value) VALUES ('ton_cursor', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [{ lt: txs[txs.length - 1]!.lt }]);
    } finally { this.busyDep = false; }
  }

  /* ---------------- withdrawals ---------------- */
  async requestWithdraw(uid: string, amount: number, to: string): Promise<{ id: number; balance: number }> {
    if (!Number.isSafeInteger(amount) || amount < this.cfg.ton.minWithdraw) throw new TonError('amount is below the minimum withdrawal');
    let raw: string;
    try { raw = parseTestnetAddress(to); } catch (err) { throw new TonError((err as Error).message || 'invalid address'); }
    const r = await this.tx(async (c) => {
      const acc = await c.query('SELECT addresses FROM ton_accounts WHERE user_id = $1 FOR UPDATE', [uid]);
      if (!(acc.rows[0]?.addresses ?? []).includes(raw)) throw new TonError('withdrawals go only to a wallet you have deposited from');
      const day = await c.query("SELECT coalesce(sum(amount), 0) AS s FROM ton_withdrawals WHERE user_id = $1 AND status <> 'failed' AND created_at >= date_trunc('day', now())", [uid]);
      if (Number(day.rows[0].s) + amount > this.cfg.ton.maxWithdrawDay) throw new TonError('daily withdrawal limit reached');
      const w = await c.query("INSERT INTO ton_withdrawals (user_id, amount, address, status) VALUES ($1,$2,$3,'pending') RETURNING id", [uid, amount, raw]);
      const id = Number(w.rows[0].id);
      const balance = await this.move(c, uid, -amount, 'withdraw', 'wd:' + id);
      return { id, balance };
    });
    this.emit('withdraw', { uid, id: r.id, status: 'pending', amount, balance: r.balance });
    return r;
  }

  /** Moves the payout queue one step. One payout at a time, so seqnos never collide. */
  async processWithdrawals(): Promise<void> {
    if (this.busyWd) return;
    this.busyWd = true;
    try {
      const sending = await this.db.query("SELECT * FROM ton_withdrawals WHERE status = 'sending' ORDER BY id LIMIT 1");
      const w = sending.rows[0];
      if (w) {
        const seqno = await this.chain.seqno();
        if (seqno > w.seqno) { // the wallet has moved past this payout's seqno: it went out
          await this.db.query("UPDATE ton_withdrawals SET status = 'sent', updated_at = now() WHERE id = $1", [w.id]);
          this.emit('withdraw', { uid: w.user_id, id: Number(w.id), status: 'sent', amount: Number(w.amount) });
          return;
        }
        const idle = Date.now() - w.updated_at.getTime();
        if (idle < RESEND_AFTER_MS) return; // give it time to land
        if (w.attempts >= GIVE_UP_AFTER) { if (idle >= FINAL_WAIT_MS) await this.fail(w, 'not confirmed on chain'); return; }
        await this.db.query('UPDATE ton_withdrawals SET attempts = attempts + 1, updated_at = now() WHERE id = $1', [w.id]);
        await this.chain.send(w.seqno, w.address, BigInt(w.amount) * NANO_PER_UNIT, `Crash Rocket payout #${w.id}`).catch((err) => console.error('resend failed', err.message));
        return;
      }
      const next = await this.db.query("SELECT * FROM ton_withdrawals WHERE status = 'pending' ORDER BY id LIMIT 1");
      const p = next.rows[0];
      if (!p) return;
      const nano = BigInt(p.amount) * NANO_PER_UNIT;
      if ((await this.chain.balance()) < nano + FEE_RESERVE) { // wait for the house to be topped up; never fail the player for it
        await this.db.query("UPDATE ton_withdrawals SET error = 'house wallet balance is low', updated_at = now() WHERE id = $1", [p.id]);
        return;
      }
      const seqno = await this.chain.seqno();
      // seqno is saved first; only then the transfer is sent
      const claimed = await this.db.query("UPDATE ton_withdrawals SET status = 'sending', seqno = $2, attempts = 1, error = NULL, updated_at = now() WHERE id = $1 AND status = 'pending' RETURNING id", [p.id, seqno]);
      if (!claimed.rows.length) return;
      this.emit('withdraw', { uid: p.user_id, id: Number(p.id), status: 'sending', amount: Number(p.amount) });
      await this.chain.send(seqno, p.address, nano, `Crash Rocket payout #${p.id}`).catch((err) => console.error('send failed, will retry', err.message));
    } finally { this.busyWd = false; }
  }

  private async fail(w: { id: string; user_id: string; amount: string }, why: string) {
    const balance = await this.tx(async (c) => {
      const u = await c.query("UPDATE ton_withdrawals SET status = 'failed', error = $2, updated_at = now() WHERE id = $1 AND status = 'sending' RETURNING id", [w.id, why]);
      if (!u.rows.length) return null;
      return this.move(c, w.user_id, Number(w.amount), 'refund', 'wdr:' + w.id);
    });
    if (balance !== null) this.emit('withdraw', { uid: w.user_id, id: Number(w.id), status: 'failed', amount: Number(w.amount), balance });
  }

  start() {
    const safe = (fn: () => Promise<void>, what: string) => () => void fn().catch((err) => console.error(`ton ${what}:`, err.message));
    this.timers.push(setInterval(safe(() => this.pollDeposits(), 'deposits'), this.cfg.ton.pollMs));
    this.timers.push(setInterval(safe(() => this.processWithdrawals(), 'withdrawals'), 3000));
  }
  stop() { this.timers.forEach(clearInterval); this.timers = []; }
}
