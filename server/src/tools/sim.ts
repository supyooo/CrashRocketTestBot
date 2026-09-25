/**
 * Crash maths simulator: npm run sim [-- --runs=200 --days=7 ...]
 *
 * 1. Checks the provably fair formula on real HMAC rounds against the theory.
 * 2. Shows that every cash-out strategy returns the same RTP.
 * 3. Runs a Monte Carlo of the business: many players per round with different bet sizes and targets,
 *    per-bet and per-round payout caps, referral payouts, then reports margin, drawdowns and the
 *    bankroll needed so a bad streak does not wipe the house out.
 *
 * Amounts are in TON of play money; the maths is the same for real TON.
 */
import { randomBytes } from 'node:crypto';
import { crashPoint, sha256hex } from '../game/fair.js';

const arg = (k: string, d: number) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? Number(a.split('=')[1]) : d;
};
const CFG = {
  edges: [100, 300, 500],          // house edge, basis points
  runs: arg('runs', 150),          // Monte Carlo runs per edge
  days: arg('days', 7),            // length of one run
  roundsPerDay: arg('rpd', 6000),  // ~14 s per round incl. betting window
  players: arg('players', 25),     // average bets per round (Poisson)
  betMedian: arg('bet', 1),        // TON, log-normal median
  betSigma: 1.2,
  minBet: 0.1,
  maxBet: arg('maxbet', 1000),
  maxWin: arg('maxwin', 10000),    // payout cap per bet
  roundCap: arg('roundcap', 50000),// payout cap per round (all players together)
  refShare: 0.4,                   // share of turnover from referred players
  refRate: 0.01,                   // 1% of their turnover goes to the referrer
  whaleChance: arg('whale', 0.03), // chance a round has a whale
  whaleBet: 500
};
// what players aim for: [share, from, to]
const STRATS: [number, number, number][] = [[0.35, 1.1, 2], [0.35, 2, 5], [0.2, 5, 20], [0.08, 20, 100], [0.02, 100, 1000]];

const R = Math.random;
function normal() { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); }
function poisson(l: number) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; }
function crashFast(edge: number) { const u = 1 - R(); const x = Math.floor((10000 - edge) / (100 * u)); return Math.max(100, x) / 100; }
function target() { let r = R(); for (const [p, a, b] of STRATS) { if (r < p) return a * Math.pow(b / a, R()); r -= p; } return 2; }
function betSize() { return Math.min(CFG.maxBet, Math.max(CFG.minBet, Math.round(CFG.betMedian * Math.exp(CFG.betSigma * normal()) * 10) / 10)); }

/* ---------- 1. formula check on real HMAC rounds ---------- */
function formulaCheck() {
  const n = 200_000, salt = 'public-salt', edge = 300;
  const T = [1.01, 1.5, 2, 5, 10, 100];
  const hits = T.map(() => 0); let instant = 0; let h = sha256hex(randomBytes(16).toString('hex'));
  for (let i = 0; i < n; i++) {
    h = sha256hex(h); const x = crashPoint(h, salt, edge) / 100;
    if (x <= 1) instant++; T.forEach((t, j) => { if (x >= t) hits[j]!++; });
  }
  console.log('\n1) Real HMAC rounds, edge 3%, ' + n.toLocaleString('en') + ' rounds');
  console.log('   target  P(reach) sim   theory   RTP at target');
  T.forEach((t, j) => { const p = hits[j]! / n; console.log(`   ${t.toFixed(2).padStart(6)}x  ${(p * 100).toFixed(2).padStart(7)}%  ${(0.97 / t * 100).toFixed(2).padStart(6)}%   ${(p * t * 100).toFixed(2)}%`); });
  console.log(`   crash shown as 1.00x (nobody can cash out): ${(instant / n * 100).toFixed(2)}% (theory ${((1 - 0.97 / 1.01) * 100).toFixed(2)}%: 3% below 1x plus 1.00-1.01x floored)`);
}

/* ---------- 2. every strategy gets the same RTP ---------- */
function strategyCheck() {
  const n = 2_000_000; console.log('\n2) RTP by cash-out target (' + n.toLocaleString('en') + ' rounds each)');
  for (const edge of CFG.edges) {
    const row = [1.2, 2, 5, 20, 100].map((t) => { let paid = 0; for (let i = 0; i < n; i++) if (crashFast(edge) >= t) paid += t; return `${t}x ${(paid / n * 100).toFixed(1)}%`; });
    console.log(`   edge ${edge / 100}%: ` + row.join('  '));
  }
}

/* ---------- 3. business Monte Carlo ---------- */
type Run = { turnover: number; ggr: number; ref: number; ngr: number; maxDD: number; worstDay: number; capped: number };
function oneRun(edge: number): Run {
  let turnover = 0, ggr = 0, pnl = 0, peak = 0, maxDD = 0, worstDay = 0, dayPnl = 0, capped = 0;
  for (let d = 0; d < CFG.days; d++) {
    dayPnl = 0;
    for (let r = 0; r < CFG.roundsPerDay; r++) {
      const crash = crashFast(edge);
      const bets: { a: number; t: number }[] = [];
      const n = poisson(CFG.players);
      for (let i = 0; i < n; i++) bets.push({ a: betSize(), t: target() });
      if (R() < CFG.whaleChance) bets.push({ a: CFG.whaleBet, t: 10 * Math.pow(5, R()) });
      bets.sort((x, y) => x.t - y.t);
      let stake = 0; for (const b of bets) stake += b.a;
      // walk the flight: players leave at their targets, caps can force everyone out early
      let paid = 0, active = stake, i = 0;
      while (i < bets.length) {
        const b = bets[i]!;
        const tCap = Math.min(b.t, CFG.maxWin / b.a);                 // per-bet cap
        const roundM = active > 0 ? (CFG.roundCap - paid) / active : Infinity; // per-round cap
        if (roundM < tCap && roundM < crash) { paid += active * roundM; capped++; active = 0; break; }
        if (tCap > crash) break;                                         // everyone left loses
        paid += b.a * tCap; active -= b.a; if (tCap < b.t) capped++; i++;
      }
      const house = stake - paid;
      turnover += stake; ggr += house; pnl += house; dayPnl += house;
      if (pnl > peak) peak = pnl; if (peak - pnl > maxDD) maxDD = peak - pnl;
    }
    if (dayPnl < worstDay) worstDay = dayPnl;
  }
  const ref = turnover * CFG.refShare * CFG.refRate;
  return { turnover, ggr, ref, ngr: ggr - ref, maxDD, worstDay, capped };
}
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]!; };
const fmt = (v: number) => Math.round(v).toLocaleString('en').padStart(11);
function business() {
  console.log(`\n3) Business Monte Carlo: ${CFG.runs} runs × ${CFG.days} days × ${CFG.roundsPerDay} rounds/day, ~${CFG.players} bets/round, bet median ${CFG.betMedian} TON,`);
  console.log(`   caps: ${CFG.maxWin} TON per bet, ${CFG.roundCap} TON per round; whale (${CFG.whaleBet} TON) in ${CFG.whaleChance * 100}% of rounds; referral ${CFG.refRate * 100}% on ${CFG.refShare * 100}% of turnover`);
  console.log('   edge   turnover/wk        GGR  GGR%     referral        NGR  NGR%   P(loss wk)  maxDD p95  maxDD p99  worst day p1');
  for (const edge of CFG.edges) {
    const runs: Run[] = []; for (let k = 0; k < CFG.runs; k++) runs.push(oneRun(edge));
    const avg = (f: (r: Run) => number) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
    const T = avg((r) => r.turnover), G = avg((r) => r.ggr), F = avg((r) => r.ref), N = avg((r) => r.ngr);
    const lossWk = runs.filter((r) => r.ngr < 0).length / runs.length;
    console.log(`   ${(edge / 100 + '%').padEnd(5)}${fmt(T)}${fmt(G)} ${(G / T * 100).toFixed(2).padStart(5)}${fmt(F)}${fmt(N)} ${(N / T * 100).toFixed(2).padStart(5)}      ${(lossWk * 100).toFixed(1).padStart(5)}%${fmt(pct(runs.map((r) => r.maxDD), .95))}${fmt(pct(runs.map((r) => r.maxDD), .99))}${fmt(pct(runs.map((r) => r.worstDay), .01))}`);
  }
  console.log('   GGR = house profit on bets; NGR = after referral payouts. maxDD = deepest fall from a previous high inside the week:');
  console.log('   the bankroll must cover it, or the house cannot pay winners during a bad streak.');
}

formulaCheck();
strategyCheck();
business();
