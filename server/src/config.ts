import { randomBytes } from 'node:crypto';

/** Money is stored as integer micro-units: 1 USDT = 1_000_000 units (USDT has 6 decimals). */
export const UNIT = 1_000_000;
export const toUnits = (usdt: number) => Math.round(usdt * UNIT);
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

  /** House edge in basis points: 500 = 5%, RTP 95% (the support model's rules; see docs/sim-*.txt for the maths). */
  edgeBps: num(env.HOUSE_EDGE_BPS, 500),
  /** Public salt mixed into every crash point. In production: a future blockchain block hash announced in advance. */
  fairSalt: env.FAIR_SALT ?? 'crash-rocket-dev-salt',
  chainLength: num(env.CHAIN_LENGTH, 100_000),

  bettingMs: num(env.BETTING_MS, 5000),
  crashedMs: num(env.CRASHED_MS, 5000),
  tickMs: 100,

  /**
   * USDT through Crypto Pay (@CryptoBot), src/pay. On when CRYPTO_PAY_TOKEN is set: then balances are USDT only, no
   * free play money. Limits are the support model's. This build refuses anything but Crypto Pay's testnet.
   */
  pay: {
    enabled: !!env.CRYPTO_PAY_TOKEN,
    token: env.CRYPTO_PAY_TOKEN ?? '',
    network: (env.CRYPTO_PAY_NETWORK ?? 'testnet') as 'testnet' | 'mainnet',
    /** Only for local runs against a stand-in of the API; empty = Crypto Pay's own address for the network. */
    url: env.CRYPTO_PAY_URL ?? '',
    minDeposit: toUnits(num(env.PAY_MIN_DEPOSIT, 10)),
    minWithdraw: toUnits(num(env.PAY_MIN_WITHDRAW, 10)),
    /** Per player per UTC day; 0 = no limit. */
    maxWithdrawDay: toUnits(num(env.PAY_MAX_WITHDRAW_DAY, 1000)),
    /** Withdrawals open once the turnover reaches this many times the deposits. */
    wager: num(env.PAY_WAGER, 2),
    pollMs: num(env.PAY_POLL_MS, 5000)
  },

  /** Admin panel (/admin). Who may sign in: Telegram ids, comma separated. */
  admin: {
    ids: (env.ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    /** The bot's username without @, for the Telegram login button. */
    botUsername: env.BOT_USERNAME ?? '',
    /** Withdrawals above this wait for an admin's approval. */
    reviewOver: toUnits(num(env.ADMIN_REVIEW_OVER, 50)),
    /** Partner's share of NGR for the RevShare summary. */
    partnerShare: num(env.PARTNER_SHARE, 0.4)
  },

  /** Support bot (src/support): the game bot answers the FAQ and passes tickets to the operators. */
  support: {
    /** SUPPORT_BOT=0 turns it off (it needs BOT_TOKEN and Postgres anyway). */
    enabled: env.SUPPORT_BOT !== '0',
    /** The operators' Telegram group (a negative id). Without it tickets go to the ADMIN_IDS in private messages. */
    chatId: env.SUPPORT_CHAT_ID ?? '',
    /** A topic of that group (a forum) to post tickets in; empty for the group's General topic. */
    topicId: env.SUPPORT_TOPIC_ID ?? '',
    partnerEmail: env.PARTNER_EMAIL ?? 'partner@boomy.pro',
    /** The official Telegram channel (vouchers, news): a button in the FAQ menu when set. */
    channelUrl: env.CHANNEL_URL ?? '',
    /** The Mini App, for the bot's "Play" button. */
    appUrl: env.APP_URL ?? 'https://supyooo.github.io/CrashRocketTestBot/',
    /** This server's public address, for links to the admin panel in tickets. */
    publicUrl: (env.PUBLIC_URL ?? '').replace(/\/$/, '')
  },

  startBalance: toUnits(num(env.START_BALANCE, 25)),
  minBet: toUnits(0.1),
  /** Per bet panel: a player may have two bets in a round, each up to this. */
  maxBet: toUnits(num(env.MAX_BET, 15)),
  /** Largest payout of a single bet; the bet is cashed out automatically when it gets there. */
  maxWin: toUnits(num(env.MAX_WIN, 75)),
  maxAutoX100: 100_000
};
export type Config = typeof config;

/** Rounds saved before the edge was stored with each round were played at the old default of 3%. */
export const LEGACY_EDGE_BPS = 300;

// Testnet only: real money waits for the legal review, whatever the variables say.
if (config.pay.enabled) {
  if (config.pay.network !== 'testnet') throw new Error('Crypto Pay: only the testnet is allowed in this build (CRYPTO_PAY_NETWORK=testnet)');
  if (!process.env.DATABASE_URL) throw new Error('payments need Postgres: set DATABASE_URL');
  config.startBalance = 0; // no free play money with real deposits
}

// With real Telegram logins a weak or missing secret would let anyone forge sessions: refuse to start.
if (config.botToken && (env.SESSION_SECRET ?? '').length < 32) {
  throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters when BOT_TOKEN is set');
}
