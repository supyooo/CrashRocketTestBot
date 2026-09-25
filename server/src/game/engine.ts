/**
 * Server-authoritative crash rounds.
 *
 *   betting (bettingMs) -> running (until the crash point) -> crashed (crashedMs) -> betting ...
 *
 * The crash point is fixed from the hash chain before betting opens and stays secret until the crash.
 * Cash-outs use the server's clock at the moment the request arrives, so a slow or tampered client can never
 * claim a multiplier the rocket had not reached. Auto cash-outs and the max-win cap settle at exactly their multiplier.
 *
 * Money calls are async (Postgres). Anything that decides an outcome happens synchronously first (the bet is
 * marked cashed before the payout is written), so two requests can never both win the same bet.
 * Time is passed in (`step(now)`), so tests drive rounds without waiting.
 */
import { EventEmitter } from 'node:events';
import type { Config } from '../config.js';
import type { Store } from '../store/store.js';
import type { Wallet } from '../wallet/wallet.js';
import { crashPoint, makeChain, newSeed } from './fair.js';
import { msTo, x100At } from './curve.js';

export type Phase = 'betting' | 'running' | 'crashed';
export type Bet = { uid: string; name: string; amount: number; autoX100?: number; cashX100?: number; payout?: number; ref: string };
export class GameError extends Error {}

export class Engine extends EventEmitter {
  phase: Phase = 'crashed';
  no = 0;
  phaseAt = 0;
  bets = new Map<string, Bet>();
  history: { no: number; x100: number }[] = [];
  commitment = '';
  private crashX100 = 0;
  private hash = '';
  private chain: string[] = [];
  private betSeq = 0;
  private opening = false;
  private pending = new Set<string>();
  /** Writes about the round (open bets, finished round) go out one after another, in order. */
  private writes: Promise<void> = Promise.resolve();

  private constructor(private cfg: Config, private store: Store, private wallet: Wallet) { super(); }

  static async create(cfg: Config, store: Store, wallet: Wallet): Promise<Engine> {
    const e = new Engine(cfg, store, wallet);
    let f = await store.fair();
    if (!f || f.nextNo > f.length) {
      const seed = newSeed();
      e.chain = makeChain(seed, cfg.chainLength);
      f = { seed, commitment: e.chain[cfg.chainLength]!, length: cfg.chainLength, nextNo: 1 };
      await store.setFair(f);
    } else e.chain = makeChain(f.seed, f.length);
    e.commitment = f.commitment;
    e.history = (await store.rounds(20)).map((r) => ({ no: r.no, x100: r.crashX100 }));
    // a round interrupted by a restart never finishes: give its unpaid stakes back
    const open = await store.openRound();
    if (open) {
      for (const b of open.bets) if (!b.paid) await wallet.refund(b.uid, b.amount, 'restart:' + b.ref);
      await store.setOpenRound(undefined);
    }
    return e;
  }

  /** Resolves when betting is open for the first round. */
  start(now: number) { return this.openBetting(now); }

  /** Advances the round clock; call it every few tens of milliseconds. */
  step(now: number) {
    if (this.opening) return;
    if (this.phase === 'betting' && now >= this.phaseAt + this.cfg.bettingMs) this.launch(now);
    else if (this.phase === 'running') {
      const elapsed = now - this.phaseAt;
      for (const b of this.bets.values()) {
        if (b.cashX100) continue;
        // automatic exits the rocket has already passed: the player's auto cash-out or the max-win cap
        const capX = Math.floor((this.cfg.maxWin * 100) / b.amount);
        const exitX = Math.min(b.autoX100 ?? Infinity, capX);
        if (exitX <= this.crashX100 && msTo(exitX) <= elapsed) void this.settle(b, exitX).catch((err) => console.error('auto cash-out failed', err));
      }
      if (elapsed >= msTo(this.crashX100)) this.crash(now);
    } else if (this.phase === 'crashed' && now >= this.phaseAt + this.cfg.crashedMs) void this.openBetting(now);
  }

  /** Current multiplier while running, else 1.00x. */
  x100(now: number) { return this.phase === 'running' ? Math.min(x100At(now - this.phaseAt), this.crashX100) : 100; }

  /** All pending writes about rounds are saved. */
  settled() { return this.writes; }

  async placeBet(uid: string, name: string, amount: number, autoX100?: number): Promise<number> {
    if (this.phase !== 'betting' || this.opening) throw new GameError('bets are closed');
    if (this.bets.has(uid) || this.pending.has(uid)) throw new GameError('you already have a bet in this round');
    if (!Number.isSafeInteger(amount) || amount < this.cfg.minBet || amount > this.cfg.maxBet) throw new GameError('bet amount is out of limits');
    if (autoX100 !== undefined && (!Number.isInteger(autoX100) || autoX100 < 101 || autoX100 > this.cfg.maxAutoX100)) throw new GameError('auto cash-out must be between 1.01x and 1000x');
    const no = this.no, ref = `bet:${no}:${uid}:${++this.betSeq}`;
    this.pending.add(uid);
    try {
      const balance = await this.wallet.stake(uid, amount, ref);
      // the database answered after this round had already ended: give the stake back
      if (this.no !== no || (this.phase as Phase) === 'crashed') {
        await this.wallet.refund(uid, amount, 'late:' + ref);
        throw new GameError('bets are closed');
      }
      this.bets.set(uid, { uid, name, amount, autoX100, ref });
      this.saveOpen();
      this.emit('bet', { uid, name, amount, balance });
      return balance;
    } finally { this.pending.delete(uid); }
  }

  async cancelBet(uid: string): Promise<number> {
    if (this.phase !== 'betting') throw new GameError('the round has started');
    const b = this.bets.get(uid);
    if (!b) throw new GameError('no bet to cancel');
    this.bets.delete(uid); // gone before the round can launch with it
    const balance = await this.wallet.refund(uid, b.amount, 'cancel:' + b.ref);
    this.saveOpen();
    this.emit('cancel', { uid, balance });
    return balance;
  }

  /** Cash out at the multiplier of this very moment. Throws if the rocket has already exploded. */
  cashout(uid: string, now: number): Promise<{ x100: number; payout: number; balance: number }> {
    if (this.phase !== 'running') throw new GameError('the rocket is not flying');
    const b = this.bets.get(uid);
    if (!b) throw new GameError('no bet in this round');
    if (b.cashX100) throw new GameError('already cashed out');
    const elapsed = now - this.phaseAt;
    if (elapsed >= msTo(this.crashX100)) throw new GameError('too late, the rocket exploded');
    return this.settle(b, Math.min(x100At(elapsed), this.crashX100));
  }

  snapshot(now: number) {
    return {
      phase: this.phase, no: this.no, phaseAt: this.phaseAt, serverNow: now,
      bettingMs: this.cfg.bettingMs, crashedMs: this.cfg.crashedMs, x100: this.x100(now),
      crashX100: this.phase === 'crashed' ? this.crashX100 : undefined,
      bets: [...this.bets.values()].map((b) => ({ uid: b.uid, name: b.name, amount: b.amount, cashX100: b.cashX100, payout: b.payout })),
      history: this.history.slice(0, 20), commitment: this.commitment, edgeBps: this.cfg.edgeBps
    };
  }

  /** Decides the win synchronously, then writes the payout (retrying: the ref makes retries safe). */
  private async settle(b: Bet, x100: number) {
    const payout = Math.min(Math.floor((b.amount * x100) / 100), this.cfg.maxWin);
    b.cashX100 = x100; b.payout = payout;
    let balance = 0;
    for (let i = 0; ; i++) {
      try { balance = await this.wallet.pay(b.uid, payout, 'win:' + b.ref); break; } catch (err) {
        if (i >= 4) throw err;
        await new Promise((r) => setTimeout(r, 100 * 2 ** i));
      }
    }
    this.saveOpen();
    this.emit('cashout', { uid: b.uid, name: b.name, x100, payout, balance });
    return { x100, payout, balance };
  }

  private async openBetting(now: number) {
    this.opening = true;
    try {
      await this.writes;
      const f = (await this.store.fair())!;
      if (f.nextNo > f.length) throw new Error('hash chain exhausted: start a new chain');
      // persist the round number before any bet: a restart never replays a hash
      await this.store.setFair({ ...f, nextNo: f.nextNo + 1 });
      this.no = f.nextNo;
      this.hash = this.chain[f.length - this.no]!;
      this.crashX100 = crashPoint(this.hash, this.cfg.fairSalt, this.cfg.edgeBps);
      this.bets.clear();
      this.phase = 'betting'; this.phaseAt = now;
      this.emit('betting', { no: this.no, phaseAt: now, endsAt: now + this.cfg.bettingMs });
    } finally { this.opening = false; }
  }

  private launch(now: number) {
    this.phase = 'running'; this.phaseAt = now;
    this.emit('run', { no: this.no, startedAt: now });
  }

  private crash(now: number) {
    const startedAt = this.phaseAt;
    this.phase = 'crashed'; this.phaseAt = now;
    this.history.unshift({ no: this.no, x100: this.crashX100 }); this.history.length = Math.min(this.history.length, 50);
    const round = { no: this.no, crashX100: this.crashX100, hash: this.hash, startedAt,
      bets: [...this.bets.values()].map((b) => ({ uid: b.uid, name: b.name, amount: b.amount, cashX100: b.cashX100, payout: b.payout })) };
    this.write(async () => { await this.store.addRound(round); await this.store.setOpenRound(undefined); });
    this.emit('crash', { no: this.no, crashX100: this.crashX100, hash: this.hash });
  }

  private saveOpen() {
    // after the crash the round is final (its record is already queued); a late payout must not reopen it
    if (this.phase === 'crashed') return;
    const open = { no: this.no, bets: [...this.bets.values()].map((b) => ({ uid: b.uid, amount: b.amount, ref: b.ref, paid: !!b.cashX100 })) };
    this.write(() => this.store.setOpenRound(open));
  }

  private write(fn: () => Promise<void>) {
    this.writes = this.writes.then(fn).catch((err) => console.error('round write failed:', err));
  }
}
