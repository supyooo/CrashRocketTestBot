/**
 * End-to-end smoke test against a running dev server: npm run smoke
 * Two play-money players log in, bet in the same round; one cashes out at ~1.2x, the other waits for the crash.
 */
import WebSocket from 'ws';

const BASE = process.env.SERVER ?? 'http://localhost:8787';
type Msg = { t: string; [k: string]: unknown };

async function login(dev: string) {
  const r = await fetch(BASE + '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dev }) });
  if (!r.ok) throw new Error('login failed ' + r.status);
  return (await r.json()) as { token: string; balance: number };
}
function connect(token: string, name: string) {
  const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws?token=' + encodeURIComponent(token));
  const log: Msg[] = [];
  ws.on('message', (d) => { const m = JSON.parse(String(d)) as Msg; log.push(m); if (['ok', 'err', 'crash', 'run'].includes(m.t)) console.log(`  ${name} <- ${JSON.stringify(m).slice(0, 140)}`); });
  return { ws, log, open: new Promise((r) => ws.once('open', r)), wait: (t: string) => new Promise<Msg>((r) => { const h = (d: WebSocket.RawData) => { const m = JSON.parse(String(d)) as Msg; if (m.t === t) { ws.off('message', h); r(m); } }; ws.on('message', h); }) };
}

const a = await login('alice'), b = await login('bob');
console.log('logged in: alice', a.balance, 'TON, bob', b.balance, 'TON');
const A = connect(a.token, 'alice'), B = connect(b.token, 'bob');
await Promise.all([A.open, B.open]);
await A.wait('betting');
A.ws.send(JSON.stringify({ t: 'bet', id: 1, amount: 2 }));
B.ws.send(JSON.stringify({ t: 'bet', id: 1, amount: 1, auto: 1.5 }));
await A.wait('run');
A.log.length = 0; // only ticks of this flight count
const t0 = Date.now();
const cash = new Promise<void>((r) => { const iv = setInterval(() => { const tick = A.log.filter((m) => m.t === 'tick').pop(); if ((tick && (tick.x as number) >= 1.2) || Date.now() - t0 > 1600) { clearInterval(iv); A.ws.send(JSON.stringify({ t: 'cashout', id: 2 })); r(); } }, 20); });
await Promise.race([cash, A.wait('crash')]);
const crash = await A.wait('crash');
await new Promise((r) => setTimeout(r, 200));
const me = async (tok: string) => (await (await fetch(BASE + '/api/me', { headers: { authorization: 'Bearer ' + tok } })).json()) as { balance: number };
console.log(`crash at ${crash.crash}x · alice balance ${(await me(a.token)).balance} · bob balance ${(await me(b.token)).balance}`);
const rounds = (await (await fetch(BASE + '/api/rounds?limit=1')).json()) as { no: number; crash: number; hash: string }[];
const fair = (await (await fetch(BASE + '/api/fair')).json()) as { commitment: string };
const { verifyRound } = await import('../game/fair.js');
console.log(`round #${rounds[0]!.no} hash revealed, leads to the commitment: ${verifyRound(rounds[0]!.hash, rounds[0]!.no, fair.commitment)}`);
A.ws.close(); B.ws.close();
