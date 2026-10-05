/**
 * Admin panel: /admin serves the page, /admin/api/* its data. Works with Postgres only.
 *
 * Sign-in: the Telegram login button; only Telegram ids listed in ADMIN_IDS get in (in dev mode without a bot
 * token, any name). Admin sessions are signed with their own key, so a player's session never opens the panel.
 * Every action that changes something is written to admin_log first and shows up in the player's card.
 * Balance corrections are ledger moves with a reason, like any other money move.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type pg from 'pg';
import type { Config } from '../config.js';
import { fromUnits, toUnits, NANO_PER_UNIT } from '../config.js';
import { AuthError, validateLoginWidget } from '../auth/telegram.js';
import { signSession, verifySession } from '../auth/session.js';
import { InsufficientFunds } from '../store/store.js';
import { TonError, type TonGateway } from '../ton/gateway.js';
import type { EngineRef } from '../http.js';

const here = dirname(fileURLToPath(import.meta.url));
const UI_DIR = join(here, '..', '..', 'admin');
const PERIODS: Record<string, string> = { today: "date_trunc('day', now())", week: "now() - interval '7 days'", month: "now() - interval '30 days'", year: "now() - interval '365 days'" };
const BUCKET: Record<string, string> = { today: 'hour', week: 'day', month: 'day', year: 'month' };
const BET_REFUND = "ref ~ '^(cancel|late|restart):'";           // stakes given back (not a loss and not a win)
const u = (n: unknown) => fromUnits(Number(n ?? 0));
const nanoToUnits = (n: unknown) => Number(BigInt(String(n ?? 0)) / NANO_PER_UNIT);

export class AdminError extends Error {}
type Who = { uid: string; name: string };
type Ctx = { cfg: Config; db: pg.Pool; ref: EngineRef; ton?: TonGateway; online: () => number };

export class Admin {
  private blocked = new Set<string>();
  private timer?: NodeJS.Timeout;
  private secret: string;

  constructor(private x: Ctx) { this.secret = x.cfg.sessionSecret + '|admin'; }

  /* ---------------- player restrictions, cached for the game loop ---------------- */
  async start() { await this.loadFlags(); this.timer = setInterval(() => void this.loadFlags().catch(() => {}), 30_000); this.timer.unref(); }
  stop() { if (this.timer) clearInterval(this.timer); }
  private async loadFlags() { const { rows } = await this.x.db.query('SELECT user_id FROM user_flags WHERE blocked'); this.blocked = new Set(rows.map((r) => r.user_id)); }
  isBlocked(uid: string) { return this.blocked.has(uid); }

  /** Remembers where a player signed in from (anti-fraud: one address, several accounts). */
  async recordLogin(uid: string, req: IncomingMessage) {
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0]!.trim();
    if (ip) await this.x.db.query('INSERT INTO logins (user_id, ip) VALUES ($1,$2) ON CONFLICT (user_id, ip) DO UPDATE SET at = now()', [uid, ip]);
  }

  /** New withdrawal under review: a message to every admin through the bot (they must have started it once). */
  async notify(text: string) {
    const { botToken, admin } = this.x.cfg;
    if (!botToken) return;
    for (const id of admin.ids) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: id, text }) })
        .catch((err) => console.error('admin notify failed:', err.message));
    }
  }

  /* ---------------- http ---------------- */
  /** Handles /admin and /admin/api/*; returns false for anything else. */
  async handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const p = url.pathname;
    if (p !== '/admin' && !p.startsWith('/admin/')) return false;
    if (p === '/admin' || p === '/admin/') return this.file(res, 'index.html', 'text/html; charset=utf-8'), true;
    if (p === '/admin/admin.js') return this.file(res, 'admin.js', 'text/javascript; charset=utf-8'), true;
    try {
      if (p === '/admin/api/config') return send(res, 200, { botUsername: this.x.cfg.admin.botUsername, dev: this.x.cfg.devAuth }), true;
      if (p === '/admin/api/login' && req.method === 'POST') return send(res, 200, await this.login(await readJson(req))), true;
      const h = req.headers.authorization;
      const s = verifySession(h?.startsWith('Bearer ') ? h.slice(7) : null, this.secret);
      if (!s) return send(res, 401, { error: 'not signed in' }), true;
      const who: Who = { uid: s.uid, name: s.name };
      const q = url.searchParams;
      const body = req.method === 'POST' ? await readJson(req) : {};
      const out = await this.route(p.slice('/admin/api'.length), req.method ?? 'GET', q, body, who);
      if (out === undefined) return send(res, 404, { error: 'not found' }), true;
      return send(res, 200, out), true;
    } catch (err) {
      if (err instanceof AuthError) return send(res, 401, { error: err.message }), true;
      if (err instanceof AdminError || err instanceof TonError || err instanceof InsufficientFunds) return send(res, 400, { error: err.message }), true;
      console.error('admin:', err);
      return send(res, 500, { error: 'server error' }), true;
    }
  }

  private file(res: ServerResponse, name: string, type: string) {
    try { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' }); res.end(readFileSync(join(UI_DIR, name))); }
    catch { send(res, 404, { error: 'not found' }); }
  }

  private async login(body: Record<string, unknown>) {
    const { cfg } = this.x;
    let uid: string, name: string;
    if (cfg.devAuth && !cfg.botToken && typeof body.dev === 'string' && /^[\w-]{1,24}$/.test(body.dev)) { uid = 'dev:' + body.dev; name = body.dev; }
    else {
      const user = validateLoginWidget(body, cfg.botToken);
      if (!cfg.admin.ids.includes(String(user.id))) throw new AuthError('this Telegram account is not an admin');
      uid = 'tg:' + user.id; name = user.username ? '@' + user.username : [user.first_name, user.last_name].filter(Boolean).join(' ') || String(user.id);
    }
    return { token: signSession({ uid, name }, this.secret, 12 * 3600), name };
  }

  private async route(p: string, method: string, q: URLSearchParams, b: Record<string, unknown>, who: Who): Promise<unknown> {
    if (method === 'GET') {
      if (p === '/me') return who;
      if (p === '/summary') return this.summary(q.get('period') ?? 'today');
      if (p === '/queue') return this.queue();
      if (p === '/cash') return this.cash();
      if (p === '/alerts') return this.alerts();
      if (p === '/player') return this.player(q.get('q') ?? '');
      return undefined;
    }
    if (p === '/withdrawals/approve') return this.approve(who, num(b.id));
    if (p === '/withdrawals/reject') return this.reject(who, num(b.id), str(b.reason));
    if (p === '/deposits/attach') return this.attach(who, str(b.tx), str(b.uid));
    if (p === '/player/action') return this.action(who, str(b.uid), str(b.action), b);
    return undefined;
  }

  private async log(who: Who, action: string, uid: string | null, data: object, c: pg.Pool | pg.PoolClient = this.x.db): Promise<number> {
    const { rows } = await c.query('INSERT INTO admin_log (admin_id, admin_name, action, user_id, data) VALUES ($1,$2,$3,$4,$5) RETURNING id', [who.uid, who.name, action, uid, data]);
    return Number(rows[0].id);
  }

  /* ---------------- dashboard ---------------- */
  async summary(period: string) {
    const since = PERIODS[period] ?? PERIODS.today!, bucket = BUCKET[period] ?? 'hour';
    const db = this.x.db;
    const [money, active, sent, chart] = await Promise.all([
      db.query(`SELECT
          coalesce(sum(-delta) FILTER (WHERE kind = 'bet'), 0) - coalesce(sum(delta) FILTER (WHERE kind = 'refund' AND ${BET_REFUND}), 0) AS turnover,
          coalesce(sum(delta) FILTER (WHERE kind = 'win'), 0) AS wins,
          coalesce(sum(delta) FILTER (WHERE kind = 'deposit'), 0) AS deposits,
          coalesce(sum(delta) FILTER (WHERE kind = 'grant' OR (kind = 'adjust' AND ref LIKE 'adm:%' AND delta > 0)), 0) AS bonuses
        FROM ledger WHERE at >= ${since}`),
      db.query(`SELECT count(DISTINCT user_id)::int AS n FROM ledger WHERE kind = 'bet' AND at >= ${since}`),
      db.query(`SELECT coalesce(sum(amount), 0) AS s FROM ton_withdrawals WHERE status = 'sent' AND updated_at >= ${since}`),
      db.query(`SELECT date_trunc('${bucket}', at) AS t,
          sum(CASE WHEN kind IN ('bet', 'win') OR (kind = 'refund' AND ${BET_REFUND}) THEN -delta ELSE 0 END) AS ggr
        FROM ledger WHERE at >= ${since} GROUP BY 1 ORDER BY 1`)
    ]);
    const m = money.rows[0];
    const turnover = Number(m.turnover), wins = Number(m.wins), ggr = turnover - wins, bonuses = Number(m.bonuses), ngr = ggr - bonuses, n = active.rows[0].n;
    const e = this.x.ref.engine;
    return {
      period, online: this.x.online(), server: { leader: !!e, round: e?.no ?? null, phase: e?.phase ?? null },
      deposits: u(m.deposits), withdrawals: u(sent.rows[0].s), turnover: u(turnover), wins: u(wins), ggr: u(ggr), bonuses: u(bonuses), ngr: u(ngr),
      active: n, arpu: n ? u(ggr / n) : 0,
      revshare: { share: this.x.cfg.admin.partnerShare, partner: u(Math.max(0, ngr) * this.x.cfg.admin.partnerShare), net: u(ngr - Math.max(0, ngr) * this.x.cfg.admin.partnerShare) },
      chart: chart.rows.map((r) => ({ t: r.t.getTime(), ggr: u(r.ggr) }))
    };
  }

  /** Bets since the player's last deposit against twice that deposit (the x2 wager rule). */
  private async wager(uid: string) {
    const db = this.x.db;
    const dep = await db.query("SELECT id, delta FROM ledger WHERE user_id = $1 AND kind = 'deposit' ORDER BY id DESC LIMIT 1", [uid]);
    if (!dep.rows.length) return { deposit: 0, need: 0, done: 0, met: false };
    const { rows } = await db.query(`SELECT coalesce(sum(-delta) FILTER (WHERE kind = 'bet'), 0) - coalesce(sum(delta) FILTER (WHERE kind = 'refund' AND ${BET_REFUND}), 0) AS s
      FROM ledger WHERE user_id = $1 AND id > $2`, [uid, dep.rows[0].id]);
    const need = 2 * Number(dep.rows[0].delta), done = Number(rows[0].s);
    return { deposit: u(dep.rows[0].delta), need: u(need), done: u(done), met: done >= need };
  }

  async queue() {
    const { rows } = await this.x.db.query("SELECT w.id, w.user_id, u.name, u.tg_id, w.amount, w.created_at FROM ton_withdrawals w JOIN users u ON u.id = w.user_id WHERE w.status = 'review' ORDER BY w.id");
    return Promise.all(rows.map(async (r) => ({ id: Number(r.id), uid: r.user_id, name: r.name, tgId: r.tg_id === null ? null : Number(r.tg_id), amount: u(r.amount), at: r.created_at.getTime(), wager: await this.wager(r.user_id) })));
  }

  async cash() {
    const db = this.x.db, { cfg, ton } = this.x;
    const [owed, payouts] = await Promise.all([
      db.query('SELECT coalesce(sum(balance), 0) AS s FROM accounts'),
      db.query("SELECT coalesce(sum(amount), 0) AS s, count(*)::int AS n FROM ton_withdrawals WHERE status IN ('review', 'pending', 'sending')")
    ]);
    let hot: number | null = null;
    if (ton) hot = await ton.houseBalance().then((n) => u(Number(n / NANO_PER_UNIT))).catch(() => null);
    return { currency: ton ? 'TON (testnet)' : 'play', hot, cold: null, owed: u(owed.rows[0].s), payouts: u(payouts.rows[0].s), payoutsCount: payouts.rows[0].n,
      limits: { minBet: u(cfg.minBet), maxBet: u(cfg.maxBet), maxWin: u(cfg.maxWin), reviewOver: u(cfg.admin.reviewOver), minDeposit: u(cfg.ton.minDeposit), minWithdraw: u(cfg.ton.minWithdraw), maxWithdrawDay: u(cfg.ton.maxWithdrawDay) } };
  }

  async alerts() {
    const db = this.x.db;
    const [deps, ips, wallets] = await Promise.all([
      db.query("SELECT tx_hash, nano, source, comment, status, at FROM ton_deposits WHERE status IN ('unmatched', 'too_small') ORDER BY at DESC LIMIT 50"),
      db.query("SELECT ip, array_agg(user_id ORDER BY user_id) AS users FROM logins WHERE at > now() - interval '30 days' GROUP BY ip HAVING count(*) > 1 ORDER BY max(at) DESC LIMIT 30"),
      db.query('SELECT a AS address, array_agg(user_id ORDER BY user_id) AS users FROM ton_accounts, unnest(addresses) a GROUP BY a HAVING count(*) > 1 LIMIT 30')
    ]);
    return {
      unmatched: deps.rows.map((d) => ({ tx: d.tx_hash, amount: u(nanoToUnits(d.nano)), from: d.source, comment: d.comment, status: d.status, at: d.at.getTime() })),
      fraud: [
        ...ips.rows.map((r) => ({ kind: 'ip', key: r.ip, users: r.users })),
        ...wallets.rows.map((r) => ({ kind: 'wallet', key: r.address, users: r.users }))
      ]
    };
  }

  /* ---------------- player card ---------------- */
  private async findUser(q: string): Promise<string | null> {
    q = q.trim();
    if (!q) return null;
    const db = this.x.db;
    const tries: [string, unknown][] = [['SELECT id FROM users WHERE id = $1', q]];
    if (/^\d+$/.test(q)) tries.push(['SELECT id FROM users WHERE tg_id = $1', q]);
    tries.push(['SELECT id FROM users WHERE lower(username) = lower($1)', q.replace(/^@/, '')]);
    tries.push(["SELECT id FROM users WHERE name ILIKE '%' || $1 || '%' ORDER BY created_at DESC LIMIT 1", q.replace(/[\\%_]/g, (m) => '\\' + m)]);
    for (const [sql, v] of tries) { const { rows } = await db.query(sql, [v]); if (rows[0]) return rows[0].id; }
    return null;
  }

  async player(q: string) {
    const uid = await this.findUser(q);
    if (!uid) throw new AdminError('no player found');
    const db = this.x.db;
    const [user, bal, flags, sums, wonStakes, sent, ips, wallets, deposits, withdrawals, bets, bonuses, log] = await Promise.all([
      db.query('SELECT id, tg_id, name, username, lang, ref_by, created_at FROM users WHERE id = $1', [uid]),
      db.query('SELECT balance FROM accounts WHERE user_id = $1', [uid]),
      db.query('SELECT blocked, frozen FROM user_flags WHERE user_id = $1', [uid]),
      db.query(`SELECT
          coalesce(sum(-delta) FILTER (WHERE kind = 'bet'), 0) - coalesce(sum(delta) FILTER (WHERE kind = 'refund' AND ${BET_REFUND}), 0) AS turnover,
          coalesce(sum(delta) FILTER (WHERE kind = 'win'), 0) AS wins,
          coalesce(sum(delta) FILTER (WHERE kind = 'deposit'), 0) AS deposits,
          coalesce(sum(delta) FILTER (WHERE kind = 'grant' OR (kind = 'adjust' AND ref LIKE 'adm:%' AND delta > 0)), 0) AS bonuses,
          count(*) FILTER (WHERE kind = 'bet')::int AS bets
        FROM ledger WHERE user_id = $1`, [uid]),
      db.query("SELECT coalesce(sum(-b.delta), 0) AS s FROM ledger b JOIN ledger w ON w.ref = 'win:' || b.ref WHERE b.user_id = $1 AND b.kind = 'bet'", [uid]),
      db.query("SELECT coalesce(sum(amount), 0) AS s FROM ton_withdrawals WHERE user_id = $1 AND status = 'sent'", [uid]),
      db.query('SELECT ip, at FROM logins WHERE user_id = $1 ORDER BY at DESC LIMIT 10', [uid]),
      db.query('SELECT addresses, deposit_code FROM ton_accounts WHERE user_id = $1', [uid]),
      db.query('SELECT tx_hash, nano, status, source, at FROM ton_deposits WHERE user_id = $1 ORDER BY at DESC LIMIT 100', [uid]),
      db.query('SELECT id, amount, address, status, seqno, error, created_at FROM ton_withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [uid]),
      // the round is matched by number and time: a new hash chain starts numbering again
      db.query(`SELECT b.ref, -b.delta AS stake, b.at, w.delta AS win, r.ref AS refunded, rd.no, rd.crash_x100, rd.hash
        FROM ledger b LEFT JOIN ledger w ON w.ref = 'win:' || b.ref
        LEFT JOIN ledger r ON r.ref IN ('cancel:' || b.ref, 'late:' || b.ref, 'restart:' || b.ref, 'admrefund:' || b.ref)
        LEFT JOIN LATERAL (SELECT no, crash_x100, hash FROM rounds
          WHERE split_part(b.ref, ':', 2) ~ '^[0-9]+$' AND no = split_part(b.ref, ':', 2)::int AND started_at BETWEEN b.at - interval '2 minutes' AND b.at + interval '2 minutes'
          ORDER BY started_at LIMIT 1) rd ON true
        WHERE b.user_id = $1 AND b.kind = 'bet' ORDER BY b.id DESC LIMIT 100`, [uid]),
      db.query("SELECT kind, delta, ref, at FROM ledger WHERE user_id = $1 AND (kind = 'grant' OR (kind = 'adjust' AND ref LIKE 'adm:%')) ORDER BY id DESC LIMIT 100", [uid]),
      db.query('SELECT id, admin_name, action, data, at FROM admin_log WHERE user_id = $1 ORDER BY id DESC LIMIT 100', [uid])
    ]);
    const us = user.rows[0], s = sums.rows[0];
    const turnover = Number(s.turnover), wins = Number(s.wins), income = turnover - wins;
    return {
      uid, tgId: us.tg_id === null ? null : Number(us.tg_id), name: us.name, username: us.username, lang: us.lang, refBy: us.ref_by, createdAt: us.created_at.getTime(),
      balance: u(bal.rows[0]?.balance), blocked: !!flags.rows[0]?.blocked, frozen: !!flags.rows[0]?.frozen,
      deposits: u(s.deposits), withdrawals: u(sent.rows[0].s), turnover: u(turnover), wins: u(wins),
      losses: u(turnover - Number(wonStakes.rows[0].s)), income: u(income), bonuses: u(s.bonuses), betsCount: s.bets,
      partner: us.ref_by ? u(Math.max(0, income) * this.x.cfg.admin.partnerShare) : 0,
      wager: await this.wager(uid),
      ips: ips.rows.map((r) => ({ ip: r.ip, at: r.at.getTime() })), wallets: wallets.rows[0]?.addresses ?? [], depositCode: wallets.rows[0]?.deposit_code ?? null,
      lists: {
        deposits: deposits.rows.map((d) => ({ at: d.at.getTime(), amount: u(nanoToUnits(d.nano)), status: d.status, provider: 'TON testnet', from: d.source, tx: d.tx_hash })),
        withdrawals: withdrawals.rows.map((w) => ({ id: Number(w.id), at: w.created_at.getTime(), amount: u(w.amount), status: w.status, provider: 'TON testnet', to: w.address, seqno: w.seqno, error: w.error })),
        bets: bets.rows.map((b) => ({ ref: b.ref, round: Number(String(b.ref).split(':')[1]), at: b.at.getTime(), stake: u(b.stake), payout: b.win === null ? 0 : u(b.win),
          crash: b.crash_x100 === null ? null : b.crash_x100 / 100, roundHash: b.hash ?? null, result: b.refunded ? 'refunded' : b.win !== null ? 'win' : 'lose' })),
        bonuses: bonuses.rows.map((g) => ({ at: g.at.getTime(), amount: u(g.delta), type: g.kind === 'grant' ? 'grant' : 'manual', code: g.ref }))
      },
      log: log.rows.map((l) => ({ id: Number(l.id), admin: l.admin_name, action: l.action, data: l.data, at: l.at.getTime() }))
    };
  }

  /* ---------------- actions ---------------- */
  private async approve(who: Who, id: number) {
    if (!this.x.ton) throw new AdminError('TON is not enabled');
    const r = await this.x.ton.approve(id);
    await this.log(who, 'approve', r.uid, { withdrawal: id, amount: u(r.amount) });
    return { ok: true };
  }
  private async reject(who: Who, id: number, reason: string) {
    if (!this.x.ton) throw new AdminError('TON is not enabled');
    if (!reason) throw new AdminError('a reason is required');
    const r = await this.x.ton.reject(id, reason);
    await this.log(who, 'reject', r.uid, { withdrawal: id, amount: u(r.amount), reason });
    return { ok: true };
  }
  private async attach(who: Who, tx: string, q: string) {
    if (!this.x.ton) throw new AdminError('TON is not enabled');
    const uid = await this.findUser(q);
    if (!uid) throw new AdminError('no player found');
    const r = await this.x.ton.attach(tx, uid);
    await this.log(who, 'attach', uid, { tx, amount: u(r.amount) });
    return { ok: true, uid };
  }

  private async action(who: Who, uid: string, action: string, b: Record<string, unknown>) {
    const db = this.x.db;
    if (!(await db.query('SELECT 1 FROM users WHERE id = $1', [uid])).rows.length) throw new AdminError('no such player');
    const reason = str(b.reason);
    const flag = { block: ['blocked', true], unblock: ['blocked', false], freeze: ['frozen', true], unfreeze: ['frozen', false] }[action] as [string, boolean] | undefined;
    if (flag) {
      await db.query(`INSERT INTO user_flags (user_id, ${flag[0]}) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET ${flag[0]} = $2, updated_at = now()`, [uid, flag[1]]);
      await this.log(who, action, uid, { reason });
      await this.loadFlags();
      return { ok: true };
    }
    if (action === 'note') {
      const text = str(b.text);
      if (!text) throw new AdminError('the note is empty');
      await this.log(who, 'note', uid, { text: text.slice(0, 1000) });
      return { ok: true };
    }
    if (action === 'adjust' || action === 'refund_bet') {
      if (!reason) throw new AdminError('a reason is required');
      const c = await db.connect();
      try {
        await c.query('BEGIN');
        let delta: number, ref: string, kind: string;
        if (action === 'adjust') {
          delta = toUnits(Number(b.amount));
          if (!Number.isSafeInteger(delta) || delta === 0) throw new AdminError('the amount must be a non-zero number');
          const id = await this.log(who, 'adjust', uid, { amount: u(delta), reason }, c);
          ref = 'adm:' + id; kind = 'adjust';
        } else {
          const betRef = str(b.ref);
          const bet = await c.query("SELECT -delta AS stake FROM ledger WHERE ref = $1 AND user_id = $2 AND kind = 'bet'", [betRef, uid]);
          if (!bet.rows.length) throw new AdminError('no such bet');
          const done = await c.query("SELECT 1 FROM ledger WHERE ref IN ('win:' || $1, 'cancel:' || $1, 'late:' || $1, 'restart:' || $1, 'admrefund:' || $1)", [betRef]);
          if (done.rows.length) throw new AdminError('this bet was already paid out or refunded');
          delta = Number(bet.rows[0].stake); ref = 'admrefund:' + betRef; kind = 'refund';
          await this.log(who, 'refund_bet', uid, { bet: betRef, amount: u(delta), reason }, c);
        }
        await c.query('INSERT INTO accounts (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [uid]);
        const upd = await c.query('UPDATE accounts SET balance = balance + $2 WHERE user_id = $1 AND balance + $2 >= 0 RETURNING balance', [uid, delta]);
        if (!upd.rows.length) throw new AdminError('the balance would go below zero');
        await c.query('INSERT INTO ledger (user_id, delta, balance, kind, ref) VALUES ($1,$2,$3,$4,$5)', [uid, delta, upd.rows[0].balance, kind, ref]);
        await c.query('COMMIT');
        return { ok: true, balance: u(upd.rows[0].balance) };
      } catch (err) { await c.query('ROLLBACK'); throw err; } finally { c.release(); }
    }
    throw new AdminError('unknown action');
  }
}

const MAX_BODY = 16 * 1024;
function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size > MAX_BODY) { reject(new AdminError('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(new AdminError('invalid json')); } });
    req.on('error', reject);
  });
}
function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => { const n = Number(v); if (!Number.isSafeInteger(n)) throw new AdminError('bad id'); return n; };
