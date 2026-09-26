/** REST API: login, profile, play-money refill, round history and the data players need to verify fairness. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Config } from './config.js';
import { fromUnits, toUnits } from './config.js';
import { InsufficientFunds } from './store/store.js';
import { TonError, type TonGateway } from './ton/gateway.js';
import type { Store } from './store/store.js';
import type { Wallet } from './wallet/wallet.js';
import type { Engine } from './game/engine.js';
import { AuthError, validateInitData } from './auth/telegram.js';
import { signSession, verifySession, type Session } from './auth/session.js';

/** The engine appears once this server holds the leader lock (see main.ts). */
export type EngineRef = { engine: Engine | null };
type Ctx = { cfg: Config; store: Store; wallet: Wallet; ref: EngineRef; ton?: TonGateway };

const MAX_BODY = 64 * 1024;
function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(new Error('invalid json')); } });
    req.on('error', reject);
  });
}
function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
const dayKey = () => new Date().toISOString().slice(0, 10);

export function sessionFrom(req: IncomingMessage, cfg: Config): Session | null {
  const h = req.headers.authorization;
  return verifySession(h?.startsWith('Bearer ') ? h.slice(7) : null, cfg.sessionSecret);
}

export function createApi({ cfg, store, wallet, ref, ton }: Ctx) {
  const mode = ton ? { currency: 'tton', network: 'testnet' } : { currency: 'play' };
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && cfg.corsOrigins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'origin');
      res.setHeader('access-control-allow-headers', 'authorization, content-type');
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    const url = new URL(req.url ?? '/', 'http://x');
    try {
      const engine = ref.engine;
      // healthy as soon as it serves; `leader` tells whether it already runs rounds
      if (url.pathname === '/health') return send(res, 200, { ok: true, leader: !!engine, round: engine?.no, phase: engine?.phase, draining: engine?.isDraining ?? false });

      if (url.pathname === '/api/auth' && req.method === 'POST') {
        const body = await readJson(req);
        let uid: string, name: string, extra: { tgId?: number; username?: string; lang?: string; refBy?: string } = {};
        if (typeof body.initData === 'string' && body.initData && cfg.botToken) {
          const d = validateInitData(body.initData, cfg.botToken);
          uid = 'tg:' + d.user.id;
          name = d.user.username ? '@' + d.user.username : [d.user.first_name, d.user.last_name].filter(Boolean).join(' ') || 'Pilot';
          extra = { tgId: d.user.id, username: d.user.username, lang: d.user.language_code, refBy: d.startParam?.startsWith('ref_') ? d.startParam.slice(4) : undefined };
        } else if (cfg.devAuth && typeof body.dev === 'string' && /^[\w-]{1,24}$/.test(body.dev)) {
          uid = 'dev:' + body.dev.toLowerCase(); name = body.dev;
        } else return send(res, 401, { error: 'sign in through Telegram' });
        let user = await store.getUser(uid);
        if (!user) {
          user = { id: uid, name, createdAt: Date.now(), ...extra };
          await store.putUser(user);
          await wallet.grant(uid, cfg.startBalance, 'grant:start:' + uid);
        } else if (user.name !== name) await store.putUser({ ...user, name });
        return send(res, 200, { token: signSession({ uid, name }, cfg.sessionSecret), user: { id: uid, name }, balance: fromUnits(await wallet.balance(uid)), mode });
      }

      if (url.pathname === '/api/fair') {
        if (!engine) return send(res, 503, { error: 'starting' });
        return send(res, 200, { commitment: engine.commitment, salt: cfg.fairSalt, edgeBps: cfg.edgeBps,
          formula: 'h = first 52 bits of HMAC-SHA256(key = salt, message = round hash); crash = max(1.00, floor((10000 - edgeBps) * 2^52 / (100 * (2^52 - h))) / 100); sha256 applied n times to the hash of round n gives the commitment' });
      }

      if (url.pathname === '/api/rounds') {
        const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 20) || 20);
        return send(res, 200, (await store.rounds(limit)).map((r) => ({ no: r.no, crash: r.crashX100 / 100, hash: r.hash, startedAt: r.startedAt, players: r.bets.length })));
      }

      const s = sessionFrom(req, cfg);
      if (!s) return send(res, 401, { error: 'not signed in' });

      if (url.pathname === '/api/me') {
        return send(res, 200, { user: { id: s.uid, name: s.name }, balance: fromUnits(await wallet.balance(s.uid)),
          ledger: (await store.ledgerOf(s.uid, 20)).map((e) => ({ kind: e.kind, delta: fromUnits(e.delta), balance: fromUnits(e.balance), at: e.at })) });
      }

      if (url.pathname === '/api/ton/info') {
        if (!ton) return send(res, 404, { error: 'test TON is not enabled' });
        const i = await ton.info(s.uid);
        return send(res, 200, { ...i, minDeposit: fromUnits(i.minDeposit), minWithdraw: fromUnits(i.minWithdraw), maxWithdrawDay: fromUnits(i.maxWithdrawDay),
          transfers: i.transfers.map((t) => ({ ...t, amount: fromUnits(t.amount) })), balance: fromUnits(await wallet.balance(s.uid)) });
      }

      if (url.pathname === '/api/ton/withdraw' && req.method === 'POST') {
        if (!ton) return send(res, 404, { error: 'test TON is not enabled' });
        const body = await readJson(req);
        if (typeof body.amount !== 'number' || typeof body.address !== 'string') return send(res, 400, { error: 'amount and address are required' });
        try {
          const r = await ton.requestWithdraw(s.uid, toUnits(body.amount), body.address);
          return send(res, 200, { id: r.id, balance: fromUnits(r.balance) });
        } catch (err) {
          if (err instanceof TonError || err instanceof InsufficientFunds) return send(res, 400, { error: err.message });
          throw err;
        }
      }

      // play money only: a free top-up when the balance runs dry, three times a day
      if (url.pathname === '/api/refill' && req.method === 'POST') {
        if (ton) return send(res, 400, { error: 'test TON mode: top up from your wallet' });
        if ((await wallet.balance(s.uid)) >= cfg.minBet * 10) return send(res, 400, { error: 'you still have play money' });
        const day = dayKey();
        const used = await store.countRefs(`refill:${s.uid}:${day}:`);
        if (used >= 3) return send(res, 429, { error: 'refill limit for today reached' });
        const balance = await wallet.grant(s.uid, cfg.startBalance, `refill:${s.uid}:${day}:${used + 1}`);
        return send(res, 200, { balance: fromUnits(balance) });
      }

      return send(res, 404, { error: 'not found' });
    } catch (err) {
      if (err instanceof AuthError) return send(res, 401, { error: err.message });
      console.error(err);
      return send(res, 500, { error: 'server error' });
    }
  });
}
