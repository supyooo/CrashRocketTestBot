/**
 * Load test against a running dev server (dev logins on): npm run stress -- --players=300 --rounds=3
 * Every player bets each round at a random moment of the betting window and cashes out at a random target, dated
 * like the app does. Measures, as players feel it:
 *   - bet and cash-out replies (send -> ok), p50 / p95 / p99 / max
 *   - how late round events reach players (run: server stamp -> arrival; same machine, same clock)
 *   - /health response time while the server is under load
 *   - errors and dropped connections
 * Use a Postgres-backed server for realistic numbers (DATABASE_URL); the dev JSON file is not built for this.
 */
import WebSocket from 'ws';

const arg = (k: string, d: number) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const BASE = process.env.SERVER ?? 'http://localhost:8787';
const PLAYERS = arg('players', 300), ROUNDS = arg('rounds', 3);

const lat = { bet: [] as number[], cashout: [] as number[], run: [] as number[], health: [] as number[], login: [] as number[] };
const errs: Record<string, number> = {};
let closed = 0, cashouts = 0, bets = 0;
const pct = (a: number[], p: number) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]!; };
const fmt = (a: number[]) => a.length ? `n=${a.length}  p50 ${pct(a, .5).toFixed(1)}  p95 ${pct(a, .95).toFixed(1)}  p99 ${pct(a, .99).toFixed(1)}  max ${Math.max(...a).toFixed(1)} ms` : 'none';

async function login(dev: string) {
  const t = performance.now();
  const r = await fetch(BASE + '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dev }) });
  if (!r.ok) throw new Error('login ' + r.status);
  lat.login.push(performance.now() - t);
  return (await r.json()) as { token: string };
}

function player(token: string, i: number) {
  return new Promise<void>((done) => {
    const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws?token=' + encodeURIComponent(token));
    const wait = new Map<number, { t: number; kind: 'bet' | 'cashout' }>();
    let id = 0, round = 0, k = 0.1, phaseAt = 0, target = 0, timer: NodeJS.Timeout | undefined;
    const send = (m: object, kind?: 'bet' | 'cashout') => { const n = ++id; if (kind) wait.set(n, { t: performance.now(), kind }); ws.send(JSON.stringify({ ...m, id: n })); };
    ws.on('message', (d) => {
      const m = JSON.parse(String(d));
      if (m.t === 'ok' || m.t === 'err') {
        const w = wait.get(m.id); if (!w) return; wait.delete(m.id);
        if (m.t === 'ok') { lat[w.kind].push(performance.now() - w.t); if (w.kind === 'cashout') cashouts++; else bets++; }
        else errs[`${w.kind}: ${m.error}`] = (errs[`${w.kind}: ${m.error}`] ?? 0) + 1;
      } else if (m.t === 'hello' && m.k) k = m.k;
      else if (m.t === 'betting') {
        if (++round > ROUNDS) { ws.close(); return; }
        setTimeout(() => send({ t: 'bet', amount: 0.1 + Math.round(Math.random() * 10) / 10 }, 'bet'), Math.random() * 3000);
      } else if (m.t === 'run') {
        if (m.k) k = m.k; phaseAt = m.startedAt; lat.run.push(Date.now() - m.serverNow);
        target = 1.1 + Math.random() * 3;                       // cash out somewhere between 1.1x and 4.1x
        const at = phaseAt + (Math.log(target) / k) * 1000;
        timer = setTimeout(() => send({ t: 'cashout', at: Date.now() }, 'cashout'), Math.max(0, at - Date.now()));
      } else if (m.t === 'crash') clearTimeout(timer);
    });
    ws.on('error', (e) => { errs['socket: ' + e.message] = (errs['socket: ' + e.message] ?? 0) + 1; });
    ws.on('close', (code) => { if (code !== 1000 && code !== 1005) closed++; done(); });
  });
}

console.log(`stress: ${PLAYERS} players x ${ROUNDS} rounds against ${BASE}`);
const tokens: string[] = [];
for (let i = 0; i < PLAYERS; i += 25) tokens.push(...(await Promise.all(Array.from({ length: Math.min(25, PLAYERS - i) }, (_, j) => login(`stress${i + j}`)))).map((x) => x.token));
console.log(`logged in ${tokens.length} players · login ${fmt(lat.login)}`);
const probe = setInterval(async () => { const t = performance.now(); try { await fetch(BASE + '/health'); lat.health.push(performance.now() - t); } catch { errs['health'] = (errs['health'] ?? 0) + 1; } }, 250);
const t0 = Date.now();
await Promise.all(tokens.map((t, i) => player(t, i)));
clearInterval(probe);
console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)} s · ${bets} bets, ${cashouts} cash-outs accepted`);
console.log(`bet reply       ${fmt(lat.bet)}`);
console.log(`cash-out reply  ${fmt(lat.cashout)}`);
console.log(`run event late  ${fmt(lat.run)}`);
console.log(`/health         ${fmt(lat.health)}`);
console.log(`dropped sockets ${closed}`);
console.log('errors', Object.keys(errs).length ? errs : 'none');
