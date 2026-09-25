/**
 * Storage. The game and the wallet only talk to the `Store` interface, so the dev file store here can be
 * swapped for Postgres (schema in sql/001_init.sql) without touching game code.
 *
 * The in-memory store is safe for money moves because Node runs them on one thread: `applyLedger` checks
 * and writes a whole batch before anything else runs. The Postgres store does the same in one transaction.
 */
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export type User = { id: string; name: string; tgId?: number; username?: string; lang?: string; refBy?: string; createdAt: number };
export type LedgerKind = 'grant' | 'bet' | 'win' | 'refund';
/** One balance movement. `ref` is unique: replaying the same operation never moves money twice. */
export type LedgerEntry = { id: number; uid: string; delta: number; balance: number; kind: LedgerKind; ref: string; at: number };
export type RoundBet = { uid: string; name: string; amount: number; cashX100?: number; payout?: number };
export type Round = { no: number; crashX100: number; hash: string; startedAt: number; bets: RoundBet[] };
export type FairState = { seed: string; commitment: string; length: number; nextNo: number };
/** Bets of the round in progress, so a restart can refund stakes of a round that never finished. */
export type OpenRound = { no: number; bets: { uid: string; amount: number; ref: string; paid: boolean }[] };

export class InsufficientFunds extends Error {}

export interface Store {
  getUser(id: string): User | undefined;
  putUser(u: User): void;
  balance(uid: string): number;
  /** Applies all moves or none. Returns the entries (existing ones if the refs were already applied). */
  applyLedger(moves: { uid: string; delta: number; kind: LedgerKind; ref: string }[]): LedgerEntry[];
  ledgerOf(uid: string, limit: number): LedgerEntry[];
  addRound(r: Round): void;
  rounds(limit: number): Round[];
  fair(): FairState | undefined;
  setFair(f: FairState): void;
  openRound(): OpenRound | undefined;
  setOpenRound(r: OpenRound | undefined): void;
  flush(): void;
}

type Snapshot = { users: User[]; balances: [string, number][]; ledger: LedgerEntry[]; rounds: Round[]; fair?: FairState; open?: OpenRound; seq: number };

export class FileStore implements Store {
  private users = new Map<string, User>();
  private balances = new Map<string, number>();
  private ledger: LedgerEntry[] = [];
  private refs = new Map<string, LedgerEntry>();
  private roundsList: Round[] = [];
  private fairState?: FairState;
  private open?: OpenRound;
  private seq = 0;
  private dirty = false;
  private timer: NodeJS.Timeout;

  constructor(private file: string) {
    if (existsSync(file)) {
      const s = JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
      s.users.forEach((u) => this.users.set(u.id, u));
      s.balances.forEach(([k, v]) => this.balances.set(k, v));
      this.ledger = s.ledger; this.ledger.forEach((e) => this.refs.set(e.ref, e));
      this.roundsList = s.rounds; this.fairState = s.fair; this.open = s.open; this.seq = s.seq;
    }
    this.timer = setInterval(() => this.flush(), 2000);
    this.timer.unref();
  }

  getUser(id: string) { return this.users.get(id); }
  putUser(u: User) { this.users.set(u.id, u); this.dirty = true; }
  balance(uid: string) { return this.balances.get(uid) ?? 0; }

  applyLedger(moves: { uid: string; delta: number; kind: LedgerKind; ref: string }[]): LedgerEntry[] {
    if (moves.every((m) => this.refs.has(m.ref))) return moves.map((m) => this.refs.get(m.ref)!);
    if (moves.some((m) => this.refs.has(m.ref))) throw new Error('partially applied batch');
    const next = new Map<string, number>();
    for (const m of moves) {
      if (!Number.isSafeInteger(m.delta)) throw new Error('amounts must be integer units');
      const b = (next.get(m.uid) ?? this.balance(m.uid)) + m.delta;
      if (b < 0) throw new InsufficientFunds('insufficient funds');
      next.set(m.uid, b);
    }
    const at = Date.now();
    const out = moves.map((m) => {
      const bal = (this.balances.get(m.uid) ?? 0) + m.delta;
      this.balances.set(m.uid, bal);
      const e: LedgerEntry = { id: ++this.seq, uid: m.uid, delta: m.delta, balance: bal, kind: m.kind, ref: m.ref, at };
      this.ledger.push(e); this.refs.set(e.ref, e);
      return e;
    });
    this.dirty = true;
    return out;
  }

  ledgerOf(uid: string, limit: number) {
    const out: LedgerEntry[] = [];
    for (let i = this.ledger.length - 1; i >= 0 && out.length < limit; i--) if (this.ledger[i]!.uid === uid) out.push(this.ledger[i]!);
    return out;
  }

  addRound(r: Round) { this.roundsList.push(r); if (this.roundsList.length > 500) this.roundsList.shift(); this.dirty = true; }
  rounds(limit: number) { return this.roundsList.slice(-limit).reverse(); }
  fair() { return this.fairState; }
  setFair(f: FairState) { this.fairState = f; this.dirty = true; this.flush(); }
  openRound() { return this.open; }
  setOpenRound(r: OpenRound | undefined) { this.open = r; this.dirty = true; }

  flush() {
    if (!this.dirty) return;
    const s: Snapshot = { users: [...this.users.values()], balances: [...this.balances], ledger: this.ledger, rounds: this.roundsList, fair: this.fairState, open: this.open, seq: this.seq };
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      writeFileSync(tmp, JSON.stringify(s));
      // atomic replace, so a crash mid-write never leaves half a file. On Windows an antivirus or indexer
      // can hold the target for a moment (EPERM/EBUSY): retry, then fall back to a direct write.
      for (let i = 0; ; i++) {
        try { renameSync(tmp, this.file); break; } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if ((code !== 'EPERM' && code !== 'EBUSY') || i >= 5) { writeFileSync(this.file, JSON.stringify(s)); break; }
          const until = Date.now() + 20 * (i + 1); while (Date.now() < until) { /* brief wait */ }
        }
      }
      this.dirty = false;
    } catch (err) {
      // never take the game down because a save failed; keep the data dirty and try again next tick
      console.error('store flush failed, will retry:', (err as Error).message);
    }
  }
}
