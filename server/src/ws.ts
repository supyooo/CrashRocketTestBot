/**
 * Real-time channel: /ws?token=<session>. Everyone gets the round events; each player also gets
 * private balance updates and replies to their own requests.
 *
 * Client -> server: {t:'bet', id, amount, auto?} | {t:'cancel', id} | {t:'cashout', id, at?} | {t:'ping', id}
 * (`at`: server time of the tap as the app estimates it from ping round-trips)
 * Server -> client: hello, betting, run, tick, crash, bet, cancel, cashout, balance, ok, err, pong
 *
 * During a deploy the new server accepts players before it runs rounds: they get `hello` with phase
 * 'waiting', then the full state once the previous server has finished its round and handed over.
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
import { K_PER_SEC } from './game/curve.js';

type Client = WebSocket & { uid: string; name: string; msgs: number; alive: boolean };
type Ev = { uid?: string; balance?: number; [k: string]: unknown };

export function attachWs(server: Server, cfg: Config, wallet: Wallet, isBlocked: (uid: string) => boolean = () => false) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  const clients = new Set<Client>();
  let engine: Engine | null = null;
  const byUser = new Map<string, Set<Client>>();         // a player's open connections, for private messages
  const send = (c: Client, m: unknown) => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(m)); };
  const all = (m: unknown) => { const s = JSON.stringify(m); for (const c of clients) if (c.readyState === WebSocket.OPEN) c.send(s); };
  const toUser = (uid: string, m: unknown) => { const set = byUser.get(uid); if (set) for (const c of set) send(c, m); };
  /* Other players' bets, cancels and cash-outs go out in batches every 100 ms: sent one by one, every bet would be a
     message to every player (300 players betting = 90 000 messages in a couple of seconds). Round events flush the
     batch first, so the order is kept. */
  let batch: unknown[] = [], batchT: NodeJS.Timeout | undefined;
  const flush = () => { if (batchT) { clearTimeout(batchT); batchT = undefined; } if (!batch.length) return; const b = batch; batch = []; all(b.length === 1 ? b[0] : { t: 'batch', m: b }); };
  const publish = (m: unknown) => { batch.push(m); batchT ??= setTimeout(flush, 100); };

  async function hello(c: Client) {
    const balance = fromUnits(await wallet.balance(c.uid));
    if (!engine) return send(c, { t: 'hello', you: { uid: c.uid, name: c.name }, balance, phase: 'waiting', serverNow: Date.now(), bets: [], history: [] });
    const snap = engine.snapshot(Date.now());
    send(c, { t: 'hello', you: { uid: c.uid, name: c.name }, balance, k: K_PER_SEC, ...snap,
      bets: snap.bets.map((b) => ({ ...b, amount: fromUnits(b.amount), payout: b.payout === undefined ? undefined : fromUnits(b.payout) })),
      history: snap.history.map((h) => ({ no: h.no, crash: h.x100 / 100 })) });
  }

  /** Called once this server runs rounds. Money is sent in TON; internal units never leave the server. */
  function setEngine(e: Engine) {
    engine = e;
    e.on('betting', (ev) => { flush(); all({ t: 'betting', ...ev }); });
    e.on('run', (ev) => { flush(); all({ t: 'run', ...ev, k: K_PER_SEC, serverNow: Date.now() }); });
    e.on('crash', (ev) => { flush(); all({ t: 'crash', no: ev.no, crash: ev.crashX100 / 100, hash: ev.hash }); });
    e.on('bet', (ev: Ev) => { publish({ t: 'bet', uid: ev.uid, name: ev.name, amount: fromUnits(ev.amount as number) }); toUser(ev.uid!, { t: 'balance', balance: fromUnits(ev.balance!) }); });
    e.on('cancel', (ev: Ev) => { publish({ t: 'cancel', uid: ev.uid }); toUser(ev.uid!, { t: 'balance', balance: fromUnits(ev.balance!) }); });
    // a cash-out is announced when decided (the player at once, everyone else in the next batch); the new balance
    // follows once the payout is written
    e.on('cashout', (ev: Ev) => { const m = { t: 'cashout', uid: ev.uid, name: ev.name, x: (ev.x100 as number) / 100, payout: fromUnits(ev.payout as number) }; toUser(ev.uid!, m); publish(m); });
    e.on('paid', (ev: Ev) => toUser(ev.uid!, { t: 'balance', balance: fromUnits(ev.balance!) }));
    for (const c of clients) void hello(c);
  }

  wss.on('connection', (ws, req) => {
    const token = new URL(req.url ?? '', 'http://x').searchParams.get('token');
    const s = verifySession(token, cfg.sessionSecret);
    if (!s) { ws.close(4001, 'not signed in'); return; }
    const c = Object.assign(ws, { uid: s.uid, name: s.name, msgs: 0, alive: true }) as Client;
    clients.add(c);
    let mine = byUser.get(c.uid); if (!mine) byUser.set(c.uid, mine = new Set()); mine.add(c);
    c.on('pong', () => { c.alive = true; });
    c.on('close', () => { clients.delete(c); const s = byUser.get(c.uid); if (s) { s.delete(c); if (!s.size) byUser.delete(c.uid); } });
    c.on('message', async (raw) => {
      if (++c.msgs > 30) { c.close(4008, 'too many messages'); return; }
      let m: { t?: string; id?: number; amount?: number; auto?: number; at?: number };
      try { m = JSON.parse(String(raw)); } catch { return; }
      const reply = (ok: boolean, extra: object) => send(c, { t: ok ? 'ok' : 'err', id: m.id, ...extra });
      try {
        if (m.t === 'ping') return send(c, { t: 'pong', id: m.id, serverNow: Date.now() });
        if (!engine) throw new GameError('the next round starts in a few seconds');
        if (m.t === 'bet') {
          if (isBlocked(c.uid)) throw new GameError('this account is blocked, contact support');
          if (typeof m.amount !== 'number') throw new GameError('amount is required');
          const auto = typeof m.auto === 'number' ? Math.round(m.auto * 100) : undefined;
          const bal = await engine.placeBet(c.uid, c.name, toUnits(m.amount), auto);
          reply(true, { balance: fromUnits(bal) });
        } else if (m.t === 'cancel') reply(true, { balance: fromUnits(await engine.cancelBet(c.uid)) });
        else if (m.t === 'cashout') {   // answered at once: the result is final; the balance comes in a 'balance' message
          const r = engine.cashoutNow(c.uid, Date.now(), m.at);
          r.paid.catch((err) => console.error('payout failed', err));
          reply(true, { x: r.x100 / 100, payout: fromUnits(r.payout) });
        }
      } catch (err) {
        if (err instanceof GameError || err instanceof InsufficientFunds) reply(false, { error: err.message });
        else { console.error(err); reply(false, { error: 'server error' }); }
      }
    });
    void hello(c);
  });

  // flight ticks for clients to correct their clock, and liveness checks
  let tickN = 0;
  const loop = setInterval(() => {
    const now = Date.now();
    if (engine && engine.phase === 'running' && ++tickN % 2 === 0) all({ t: 'tick', x: engine.x100(now) / 100, serverNow: now });
    for (const c of clients) c.msgs = 0;
  }, 250);
  const ping = setInterval(() => { for (const c of clients) { if (!c.alive) { c.terminate(); continue; } c.alive = false; c.ping(); } }, 30_000);

  return {
    setEngine,
    /** Private message to every connection of one player (deposit credited, payout sent…). */
    toUser,
    /** Ends every connection with a reason the app understands (1012 = server update, reconnect soon). */
    closeAll(code: number, reason: string) { flush(); clearInterval(loop); clearInterval(ping); for (const c of clients) c.close(code, reason); wss.close(); },
    get size() { return clients.size; }
  };
}
