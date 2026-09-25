/**
 * Real-time channel: /ws?token=<session>. Everyone gets the round events; each player also gets
 * private balance updates and replies to their own requests.
 *
 * Client -> server: {t:'bet', id, amount, auto?} | {t:'cancel', id} | {t:'cashout', id} | {t:'ping', id}
 * Server -> client: hello, betting, run, tick, crash, bet, cancel, cashout, balance, ok, err, pong
 */
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Config } from './config.js';
import { fromUnits, toUnits } from './config.js';
import type { Wallet } from './wallet/wallet.js';
import type { Engine } from './game/engine.js';
import { GameError } from './game/engine.js';
import { InsufficientFunds } from './store/store.js';
import { verifySession } from './auth/session.js';

type Client = WebSocket & { uid: string; name: string; msgs: number; alive: boolean };
type Ev = { uid?: string; balance?: number; [k: string]: unknown };

export function attachWs(server: Server, cfg: Config, engine: Engine, wallet: Wallet) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  const clients = new Set<Client>();
  const send = (c: Client, m: unknown) => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(m)); };
  const all = (m: unknown) => { const s = JSON.stringify(m); for (const c of clients) if (c.readyState === WebSocket.OPEN) c.send(s); };
  const toUser = (uid: string, m: unknown) => { for (const c of clients) if (c.uid === uid) send(c, m); };

  // public round events; money is sent in TON for the client, internal units never leave the server
  engine.on('betting', (e) => all({ t: 'betting', ...e }));
  engine.on('run', (e) => all({ t: 'run', ...e, serverNow: Date.now() }));
  engine.on('crash', (e) => all({ t: 'crash', no: e.no, crash: e.crashX100 / 100, hash: e.hash }));
  engine.on('bet', (e: Ev) => { all({ t: 'bet', uid: e.uid, name: e.name, amount: fromUnits(e.amount as number) }); toUser(e.uid!, { t: 'balance', balance: fromUnits(e.balance!) }); });
  engine.on('cancel', (e: Ev) => { all({ t: 'cancel', uid: e.uid }); toUser(e.uid!, { t: 'balance', balance: fromUnits(e.balance!) }); });
  engine.on('cashout', (e: Ev) => {
    all({ t: 'cashout', uid: e.uid, name: e.name, x: (e.x100 as number) / 100, payout: fromUnits(e.payout as number) });
    toUser(e.uid!, { t: 'balance', balance: fromUnits(e.balance!) });
  });

  wss.on('connection', async (ws, req) => {
    const token = new URL(req.url ?? '', 'http://x').searchParams.get('token');
    const s = verifySession(token, cfg.sessionSecret);
    if (!s) { ws.close(4001, 'not signed in'); return; }
    const c = Object.assign(ws, { uid: s.uid, name: s.name, msgs: 0, alive: true }) as Client;
    clients.add(c);
    const balance = await wallet.balance(s.uid);
    const snap = engine.snapshot(Date.now());
    send(c, { t: 'hello', you: { uid: s.uid, name: s.name }, balance: fromUnits(balance), ...snap,
      bets: snap.bets.map((b) => ({ ...b, amount: fromUnits(b.amount), payout: b.payout === undefined ? undefined : fromUnits(b.payout) })),
      history: snap.history.map((h) => ({ no: h.no, crash: h.x100 / 100 })) });
    c.on('pong', () => { c.alive = true; });
    c.on('close', () => clients.delete(c));
    c.on('message', async (raw) => {
      if (++c.msgs > 30) { c.close(4008, 'too many messages'); return; }
      let m: { t?: string; id?: number; amount?: number; auto?: number };
      try { m = JSON.parse(String(raw)); } catch { return; }
      const reply = (ok: boolean, extra: object) => send(c, { t: ok ? 'ok' : 'err', id: m.id, ...extra });
      try {
        if (m.t === 'bet') {
          if (typeof m.amount !== 'number') throw new GameError('amount is required');
          const auto = typeof m.auto === 'number' ? Math.round(m.auto * 100) : undefined;
          const bal = await engine.placeBet(c.uid, c.name, toUnits(m.amount), auto);
          reply(true, { balance: fromUnits(bal) });
        } else if (m.t === 'cancel') reply(true, { balance: fromUnits(await engine.cancelBet(c.uid)) });
        else if (m.t === 'cashout') { const r = await engine.cashout(c.uid, Date.now()); reply(true, { x: r.x100 / 100, payout: fromUnits(r.payout), balance: fromUnits(r.balance) }); }
        else if (m.t === 'ping') send(c, { t: 'pong', id: m.id, serverNow: Date.now() });
      } catch (err) {
        if (err instanceof GameError || err instanceof InsufficientFunds) reply(false, { error: err.message });
        else { console.error(err); reply(false, { error: 'server error' }); }
      }
    });
  });

  // flight ticks for clients to correct their clock, and liveness checks
  let tickN = 0;
  const loop = setInterval(() => {
    const now = Date.now();
    if (engine.phase === 'running' && ++tickN % 2 === 0) all({ t: 'tick', x: engine.x100(now) / 100, serverNow: now });
    for (const c of clients) c.msgs = 0;
  }, 250);
  const ping = setInterval(() => { for (const c of clients) { if (!c.alive) { c.terminate(); continue; } c.alive = false; c.ping(); } }, 30_000);
  wss.on('close', () => { clearInterval(loop); clearInterval(ping); });
  return wss;
}
