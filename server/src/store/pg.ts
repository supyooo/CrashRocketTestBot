/**
 * Postgres store. Every money move is one short transaction:
 *   skip if the ref is already in the ledger  ->  UPDATE the balance only if it stays >= 0  ->  INSERT the ledger row.
 * The unique ref and the CHECK (balance >= 0) are the last line of defence even if two requests race.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { InsufficientFunds, type FairState, type LedgerEntry, type LedgerMove, type OpenRound, type Round, type Snapshot, type Store, type User } from './store.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = join(here, '..', '..', 'sql', '001_init.sql');

type LedgerRow = { id: string; user_id: string; delta: string; balance: string; kind: LedgerEntry['kind']; ref: string; at: Date };
const toEntry = (r: LedgerRow): LedgerEntry => ({ id: Number(r.id), uid: r.user_id, delta: Number(r.delta), balance: Number(r.balance), kind: r.kind, ref: r.ref, at: r.at.getTime() });

export class PgStore implements Store {
  private pool: pg.Pool;
  private commitment = '';

  private constructor(url: string) {
    // Railway's internal network is plain TCP; public URLs need TLS
    const ssl = /sslmode=require|proxy\.rlwy\.net/.test(url) ? { rejectUnauthorized: false } : undefined;
    this.pool = new pg.Pool({ connectionString: url, max: 10, ssl, idleTimeoutMillis: 30_000 });
    this.pool.on('error', (err) => console.error('postgres pool error:', err.message));
  }

  static async open(url: string): Promise<PgStore> {
    const s = new PgStore(url);
    await s.pool.query(readFileSync(SCHEMA, 'utf8'));
    s.commitment = (await s.fair())?.commitment ?? '';
    return s;
  }

  /** One-time move of a dev FileStore snapshot into an empty database. */
  async importSnapshot(snap: Snapshot): Promise<boolean> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const { rows } = await c.query('SELECT count(*)::int AS n FROM users');
      if (rows[0].n > 0) { await c.query('ROLLBACK'); return false; }
      for (const u of snap.users) {
        await c.query('INSERT INTO users (id, tg_id, name, username, lang, ref_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,to_timestamp($7/1000.0))',
          [u.id, u.tgId ?? null, u.name, u.username ?? null, u.lang ?? null, u.refBy ?? null, u.createdAt]);
      }
      for (const [uid, bal] of snap.balances) await c.query('INSERT INTO accounts (user_id, balance) VALUES ($1,$2)', [uid, bal]);
      for (const e of snap.ledger) {
        await c.query('INSERT INTO ledger (user_id, delta, balance, kind, ref, at) VALUES ($1,$2,$3,$4,$5,to_timestamp($6/1000.0))', [e.uid, e.delta, e.balance, e.kind, e.ref, e.at]);
      }
      if (snap.fair) {
        await c.query("INSERT INTO kv (key, value) VALUES ('fair', $1)", [snap.fair]);
        for (const r of snap.rounds) {
          await c.query('INSERT INTO rounds (commitment, no, crash_x100, hash, started_at, bets) VALUES ($1,$2,$3,$4,to_timestamp($5/1000.0),$6) ON CONFLICT DO NOTHING',
            [snap.fair.commitment, r.no, r.crashX100, r.hash, r.startedAt, JSON.stringify(r.bets)]);
        }
      }
      if (snap.open) await c.query("INSERT INTO kv (key, value) VALUES ('open', $1)", [snap.open]);
      await c.query('COMMIT');
      this.commitment = snap.fair?.commitment ?? this.commitment;
      return true;
    } catch (err) { await c.query('ROLLBACK'); throw err; } finally { c.release(); }
  }

  async getUser(id: string): Promise<User | undefined> {
    const { rows } = await this.pool.query('SELECT id, tg_id, name, username, lang, ref_by, created_at FROM users WHERE id = $1', [id]);
    const r = rows[0];
    return r ? { id: r.id, tgId: r.tg_id === null ? undefined : Number(r.tg_id), name: r.name, username: r.username ?? undefined, lang: r.lang ?? undefined, refBy: r.ref_by ?? undefined, createdAt: r.created_at.getTime() } : undefined;
  }

  async putUser(u: User) {
    await this.pool.query(
      `INSERT INTO users (id, tg_id, name, username, lang, ref_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,to_timestamp($7/1000.0))
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, username = EXCLUDED.username, lang = EXCLUDED.lang`,
      [u.id, u.tgId ?? null, u.name, u.username ?? null, u.lang ?? null, u.refBy ?? null, u.createdAt]);
  }

  async balance(uid: string) {
    const { rows } = await this.pool.query('SELECT balance FROM accounts WHERE user_id = $1', [uid]);
    return rows[0] ? Number(rows[0].balance) : 0;
  }

  async applyLedger(moves: LedgerMove[]): Promise<LedgerEntry[]> {
    for (const m of moves) if (!Number.isSafeInteger(m.delta)) throw new Error('amounts must be integer units');
    const refs = moves.map((m) => m.ref);
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const done = await c.query<LedgerRow>('SELECT * FROM ledger WHERE ref = ANY($1)', [refs]);
      if (done.rows.length === moves.length) { await c.query('COMMIT'); return refs.map((r) => toEntry(done.rows.find((x) => x.ref === r)!)); }
      if (done.rows.length) throw new Error('partially applied batch');
      const out: LedgerEntry[] = [];
      for (const m of moves) {
        await c.query('INSERT INTO accounts (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [m.uid]);
        const upd = await c.query('UPDATE accounts SET balance = balance + $2 WHERE user_id = $1 AND balance + $2 >= 0 RETURNING balance', [m.uid, m.delta]);
        if (!upd.rows.length) throw new InsufficientFunds('insufficient funds');
        const ins = await c.query<LedgerRow>('INSERT INTO ledger (user_id, delta, balance, kind, ref) VALUES ($1,$2,$3,$4,$5) RETURNING *', [m.uid, m.delta, upd.rows[0].balance, m.kind, m.ref]);
        out.push(toEntry(ins.rows[0]!));
      }
      await c.query('COMMIT');
      return out;
    } catch (err) {
      await c.query('ROLLBACK');
      // the same ref committed by a parallel request in the meantime: report what is stored
      if ((err as { code?: string }).code === '23505') {
        const again = await this.pool.query<LedgerRow>('SELECT * FROM ledger WHERE ref = ANY($1)', [refs]);
        if (again.rows.length === moves.length) return refs.map((r) => toEntry(again.rows.find((x) => x.ref === r)!));
      }
      throw err;
    } finally { c.release(); }
  }

  async ledgerOf(uid: string, limit: number) {
    const { rows } = await this.pool.query<LedgerRow>('SELECT * FROM ledger WHERE user_id = $1 ORDER BY id DESC LIMIT $2', [uid, limit]);
    return rows.map(toEntry);
  }

  async countRefs(prefix: string) {
    const { rows } = await this.pool.query("SELECT count(*)::int AS n FROM ledger WHERE ref LIKE $1 || '%'", [prefix.replace(/[\\%_]/g, (m) => '\\' + m)]);
    return rows[0].n as number;
  }

  async addRound(r: Round) {
    await this.pool.query('INSERT INTO rounds (commitment, no, crash_x100, hash, started_at, bets) VALUES ($1,$2,$3,$4,to_timestamp($5/1000.0),$6) ON CONFLICT DO NOTHING',
      [this.commitment, r.no, r.crashX100, r.hash, r.startedAt, JSON.stringify(r.bets)]);
  }

  async rounds(limit: number): Promise<Round[]> {
    const { rows } = await this.pool.query('SELECT no, crash_x100, hash, started_at, bets FROM rounds WHERE commitment = $1 ORDER BY no DESC LIMIT $2', [this.commitment, limit]);
    return rows.map((r) => ({ no: r.no, crashX100: r.crash_x100, hash: r.hash, startedAt: r.started_at.getTime(), bets: r.bets }));
  }

  async fair(): Promise<FairState | undefined> {
    const { rows } = await this.pool.query("SELECT value FROM kv WHERE key = 'fair'");
    return rows[0]?.value;
  }
  async setFair(f: FairState) {
    await this.pool.query("INSERT INTO kv (key, value) VALUES ('fair', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [f]);
    this.commitment = f.commitment;
  }
  async openRound(): Promise<OpenRound | undefined> {
    const { rows } = await this.pool.query("SELECT value FROM kv WHERE key = 'open'");
    return rows[0]?.value ?? undefined;
  }
  async setOpenRound(r: OpenRound | undefined) {
    if (r) await this.pool.query("INSERT INTO kv (key, value) VALUES ('open', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [r]);
    else await this.pool.query("DELETE FROM kv WHERE key = 'open'");
  }
  async close() { await this.pool.end(); }
}
