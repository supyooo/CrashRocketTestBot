/**
 * Storage. The game and the wallet only talk to the `Store` interface:
 *   - PgStore (store/pg.ts) in production, when DATABASE_URL is set;
 *   - FileStore below for local development without a database.
 *
 * Money moves go through `applyLedger`: a batch is applied completely or not at all, a balance can never go
 * below zero, and every move carries a unique `ref`, so repeating an operation never moves money twice.
 */
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export type User = { id: string; name: string; tgId?: number; username?: string; lang?: string; refBy?: string; createdAt: number };
export type LedgerKind = 'grant' | 'bet' | 'win' | 'refund';
export type LedgerMove = { uid: string; delta: number; kind: LedgerKind; ref: string };
/** One balance movement. `ref` is unique: replaying the same operation never moves money twice. */
export type LedgerEntry = { id: number; uid: string; delta: number; balance: number; kind: LedgerKind; ref: string; at: number };
export type RoundBet = { uid: string; name: string; amount: number; cashX100?: number; payout?: number };
export type Round = { no: number; crashX100: number; hash: string; startedAt: number; bets: RoundBet[] };
export type FairState = { seed: string; commitment: string; length: number; nextNo: number };
/** Bets of the round in progress, so a restart can refund stakes of a round that never finished. */
export type OpenRound = { no: number; bets: { uid: string; amount: number; ref: string; paid: boolean }[] };

export class InsufficientFunds extends Error {}

export interface Store {
  getUser(id: string): Promise<User | undefined>;
  putUser(u: User): Promise<void>;
  balance(uid: string): Promise<number>;
  /** Applies all moves or none. Returns the entries (the existing ones if these refs were already applied). */
  applyLedger(moves: LedgerMove[]): Promise<LedgerEntry[]>;
  ledgerOf(uid: string, limit: number): Promise<LedgerEntry[]>;
  countRefs(prefix: string): Promise<number>;
  addRound(r: Round): Promise<void>;
  rounds(limit: number): Promise<Round[]>;
  fair(): Promise<FairState | undefined>;
  setFair(f: FairState): Promise<void>;
  openRound(): Promise<OpenRound | undefined>;
  setOpenRound(r: OpenRound | undefined): Promise<void>;
  close(): Promise<void>;
}

/** Everything a store holds, as saved by FileStore; also the import format for moving dev data into Postgres. */
export type Snapshot = { users: User[]; balances: [string, number][]; ledger: LedgerEntry[]; rounds: Round[]; fair?: FairState; open?: OpenRound; seq: number };

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
    const s = FileStore.read(file);
    if (s) {
      s.users.forEach((u) => this.users.set(u.id, u));
      s.balances.forEach(([k, v]) => this.balances.set(k, v));
      this.ledger = s.ledger; this.ledger.forEach((e) => this.refs.set(e.ref, e));
      this.roundsList = s.rounds; this.fairState = s.fair; this.open = s.open; this.seq = s.seq;
    }
    this.timer = setInterval(() => this.flush(), 2000);
    this.timer.unref();
  }

  static read(file: string): Snapshot | undefined {
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Snapshot) : undefined;
  }

  async getUser(id: string) { return this.users.get(id); }
  async putUser(u: User) { this.users.set(u.id, u); this.dirty = true; }
  async balance(uid: string) { return this.balances.get(uid) ?? 0; }

  // runs to completion without awaiting, so on Node's single thread nothing can interleave with it
  async applyLedger(moves: LedgerMove[]): Promise<LedgerEntry[]> {
    if (moves.every((m) => this.refs.has(m.ref))) return moves.map((m) => this.refs.get(m.ref)!);
    if (moves.some((m) => this.refs.has(m.ref))) throw new Error('partially applied batch');
    const next = new Map<string, number>();
    for (const m of moves) {
      if (!Number.isSafeInteger(m.delta)) throw new Error('amounts must be integer units');
      const b = (next.get(m.uid) ?? this.balances.get(m.uid) ?? 0) + m.delta;
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

  async ledgerOf(uid: string, limit: number) {
    const out: LedgerEntry[] = [];
    for (let i = this.ledger.length - 1; i >= 0 && out.length < limit; i--) if (this.ledger[i]!.uid === uid) out.push(this.ledger[i]!);
    return out;
  }
  async countRefs(prefix: string) { let n = 0; for (const r of this.refs.keys()) if (r.startsWith(prefix)) n++; return n; }

  async addRound(r: Round) { this.roundsList.push(r); if (this.roundsList.length > 500) this.roundsList.shift(); this.dirty = true; }
  async rounds(limit: number) { return this.roundsList.slice(-limit).reverse(); }
  async fair() { return this.fairState; }
  async setFair(f: FairState) { this.fairState = f; this.dirty = true; this.flush(); }
  async openRound() { return this.open; }
  async setOpenRound(r: OpenRound | undefined) { this.open = r; this.dirty = true; }
  async close() { clearInterval(this.timer); this.flush(); }

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
