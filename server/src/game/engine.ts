/**
 * Server-authoritative crash rounds.
 *
 *   betting (bettingMs) -> running (until the crash point) -> crashed (crashedMs) -> betting ...
 *
 * The crash point is fixed from the hash chain before betting opens and stays secret until the crash.
 * Cash-outs use the server's clock at the moment the request arrives, so a slow or tampered client can
 * never claim a multiplier the rocket had not reached. Auto cash-outs and the max-win cap are settled
 * by the server at exactly their multiplier.
 *
 * Time is passed in (`step(now)`), so tests can drive rounds without waiting.
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
  private crashX100 = 0;
  private hash = '';
  private chain: string[] = [];
  private betSeq = 0;

  constructor(private cfg: Config, private store: Store, private wallet: Wallet) {
    super();
    let f = store.fair();
    if (!f || f.nextNo > f.length) {
      const seed = newSeed();
      this.chain = makeChain(seed, cfg.chainLength);
      f = { seed, commitment: this.chain[cfg.chainLength]!, length: cfg.chainLength, nextNo: 1 };
      store.setFair(f);
    } else {
      this.chain = makeChain(f.seed, f.length);
    }
    this.history = store.rounds(20).map((r) => ({ no: r.no, x100: r.crashX100 }));
    // a round interrupted by a restart never finishes: give its unpaid stakes back
    const open = store.openRound();
    if (open) {
      for (const b of open.bets) if (!b.paid) wallet.refund(b.uid, b.amount, 'restart:' + b.ref);
      store.setOpenRound(undefined);
    }
  }

  get commitment() { return this.store.fair()!.commitment; }

  start(now: number) { this.openBetting(now); }

  /** Advances the round clock; call it every few tens of milliseconds. */
  step(now: number) {
    if (this.phase === 'betting' && now >= this.phaseAt + this.cfg.bettingMs) this.launch(now);
    else if (this.phase === 'running') {
      const elapsed = now - this.phaseAt;
      for (const b of this.bets.values()) {
        if (b.cashX100) continue;
        // automatic exits the rocket has already passed: user's auto cash-out or the max-win cap
        const capX = Math.floor((this.cfg.maxWin * 100) / b.amount);
        const exitX = Math.min(b.autoX100 ?? Infinity, capX);
        if (exitX <= this.crashX100 && msTo(exitX) <= elapsed) this.settle(b, exitX);
      }
      if (elapsed >= msTo(this.crashX100)) this.crash(now);
    } else if (this.phase === 'crashed' && now >= this.phaseAt + this.cfg.crashedMs) this.openBetting(now);
  }

  /** Current multiplier while running, else 1.00x. */
  x100(now: number) { return this.phase === 'running' ? Math.min(x100At(now - this.phaseAt), this.crashX100) : 100; }

  placeBet(uid: string, name: string, amount: number, autoX100?: number): number {
    if (this.phase !== 'betting') throw new GameError('bets are closed');
    if (this.bets.has(uid)) throw new GameError('you already have a bet in this round');
    if (!Number.isSafeInteger(amount) || amount < this.cfg.minBet || amount > this.cfg.maxBet) throw new GameError('bet amount is out of limits');
    if (autoX100 !== undefined && (!Number.isInteger(autoX100) || autoX100 < 101 || autoX100 > this.cfg.maxAutoX100)) throw new GameError('auto cash-out must be between 1.01x and 1000x');
    const ref = `bet:${this.no}:${uid}:${++this.betSeq}`;
    const balance = this.wallet.stake(uid, amount, ref);
    const bet: Bet = { uid, name, amount, autoX100, ref };
    this.bets.set(uid, bet);
    this.saveOpen();
    this.emit('bet', { uid, name, amount, balance });
    return balance;
  }

  cancelBet(uid: string): number {
    if (this.phase !== 'betting') throw new GameError('the round has started');
    const b = this.bets.get(uid);
    if (!b) throw new GameError('no bet to cancel');
    this.bets.delete(uid);
    const balance = this.wallet.refund(uid, b.amount, 'cancel:' + b.ref);
    this.saveOpen();
    this.emit('cancel', { uid, balance });
    return balance;
  }

  /** Cash out at the multiplier of this very moment. Throws if the rocket has already crashed. */
  cashout(uid: string, now: number): { x100: number; payout: number; balance: number } {
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

  private settle(b: Bet, x100: number) {
    const payout = Math.min(Math.floor((b.amount * x100) / 100), this.cfg.maxWin);
    b.cashX100 = x100; b.payout = payout;
    const balance = this.wallet.pay(b.uid, payout, 'win:' + b.ref);
    this.saveOpen();
    this.emit('cashout', { uid: b.uid, name: b.name, x100, payout, balance });
    return { x100, payout, balance };
  }

  private openBetting(now: number) {
    const f = this.store.fair()!;
    if (f.nextNo > f.length) throw new Error('hash chain exhausted: start a new chain');
    this.no = f.nextNo;
    this.hash = this.chain[f.length - this.no]!;
    this.crashX100 = crashPoint(this.hash, this.cfg.fairSalt, this.cfg.edgeBps);
    // persist the round number before any bet: a restart never replays a hash
    this.store.setFair({ ...f, nextNo: f.nextNo + 1 });
    this.phase = 'betting'; this.phaseAt = now; this.bets.clear();
    this.emit('betting', { no: this.no, phaseAt: now, endsAt: now + this.cfg.bettingMs });
  }

  private launch(now: number) {
    this.phase = 'running'; this.phaseAt = now;
    this.emit('run', { no: this.no, startedAt: now });
  }

  private crash(now: number) {
    const startedAt = this.phaseAt;
    this.phase = 'crashed'; this.phaseAt = now;
    this.history.unshift({ no: this.no, x100: this.crashX100 }); this.history.length = Math.min(this.history.length, 50);
    this.store.addRound({ no: this.no, crashX100: this.crashX100, hash: this.hash, startedAt,
      bets: [...this.bets.values()].map((b) => ({ uid: b.uid, name: b.name, amount: b.amount, cashX100: b.cashX100, payout: b.payout })) });
    this.store.setOpenRound(undefined);
    this.emit('crash', { no: this.no, crashX100: this.crashX100, hash: this.hash });
  }

  private saveOpen() {
    this.store.setOpenRound({ no: this.no, bets: [...this.bets.values()].map((b) => ({ uid: b.uid, amount: b.amount, ref: b.ref, paid: !!b.cashX100 })) });
  }
}
