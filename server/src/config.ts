import { randomBytes } from 'node:crypto';

/** Money is stored as integer micro-units: 1 TON (play money for now) = 1_000_000 units. */
export const UNIT = 1_000_000;
export const toUnits = (ton: number) => Math.round(ton * UNIT);
export const fromUnits = (u: number) => u / UNIT;

const env = process.env;
const num = (v: string | undefined, d: number) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  port: num(env.PORT, 8787),
  /** Telegram bot token. Without it the server runs in dev mode and accepts dev logins. */
  botToken: env.BOT_TOKEN ?? '',
  /** Signs session tokens. Must be set in production, otherwise sessions die on every restart. */
  sessionSecret: env.SESSION_SECRET || randomBytes(32).toString('hex'),
  devAuth: env.DEV_AUTH === '1' || !env.BOT_TOKEN,
  /** Allowed browser origins for the API. */
  corsOrigins: (env.CORS_ORIGINS ?? 'https://supyooo.github.io,http://localhost:5173,http://127.0.0.1:5173').split(','),
  dataFile: env.DATA_FILE ?? 'data/dev-db.json',

  /** House edge in basis points: 300 = 3%. Chosen from the simulator (see docs/sim-*.txt). */
  edgeBps: num(env.HOUSE_EDGE_BPS, 300),
  /** Public salt mixed into every crash point. In production: a future blockchain block hash announced in advance. */
  fairSalt: env.FAIR_SALT ?? 'crash-rocket-dev-salt',
  chainLength: num(env.CHAIN_LENGTH, 100_000),

  bettingMs: num(env.BETTING_MS, 5000),
  crashedMs: num(env.CRASHED_MS, 3000),
  tickMs: 100,

  startBalance: toUnits(num(env.START_BALANCE, 25)),
  minBet: toUnits(0.1),
  maxBet: toUnits(num(env.MAX_BET, 1000)),
  /** Largest payout of a single bet; the bet is cashed out automatically when it gets there. */
  maxWin: toUnits(num(env.MAX_WIN, 10_000)),
  maxAutoX100: 100_000
};
export type Config = typeof config;

// With real Telegram logins a weak or missing secret would let anyone forge sessions: refuse to start.
if (config.botToken && (env.SESSION_SECRET ?? '').length < 32) {
  throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters when BOT_TOKEN is set');
}
