# Boomy server

Game server for the Telegram Mini App. Play money only for now: no deposits or withdrawals.

- **Provably fair rounds** from a SHA-256 hash chain (`src/game/fair.ts`).
- **Server-authoritative** betting, cash-out, auto cash-out and max-win cap (`src/game/engine.ts`).
- **Wallet with a ledger**: every balance move is an idempotent ledger entry in integer micro-units (`src/wallet`, `src/store`).
- **Telegram login**: `initData` signature check (`src/auth/telegram.ts`), signed session tokens.
- REST API (`src/http.ts`) and a WebSocket channel for live rounds (`src/ws.ts`).

One process, split into modules. The game loop, the API and the bot can later run as separate processes without touching the modules.

## Run locally

```bash
npm install
npm run dev          # http://localhost:8787, dev logins enabled when BOT_TOKEN is not set
npm test             # fairness, engine, auth
npm run smoke        # two dev players play a real round against the running server
npm run sim          # maths simulator (npm run sim -- --runs=100 --maxwin=10000)
npm run devdb        # local Postgres without Docker, then DATABASE_URL=postgres://postgres:dev@127.0.0.1:54320/crash npm run dev
```

Tests run every game scenario against both stores, including a real embedded Postgres (race and idempotency checks).

Open the game against it: `http://localhost:5173/app/?server=http://localhost:8787&dev=alice` (serve the repo root on port 5173).
Without `?server=` the game runs its offline demo rounds.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 8787 | HTTP and WebSocket port |
| `BOT_TOKEN` | — | Telegram bot token. When set, only Telegram logins are accepted |
| `SESSION_SECRET` | random | Signs session tokens. **Set it in production**, or sessions reset on every restart |
| `DEV_AUTH` | on without a token | `1` allows `{dev: "name"}` logins |
| `CORS_ORIGINS` | GitHub Pages + localhost | Comma-separated allowed origins |
| `HOUSE_EDGE_BPS` | 500 | House edge, basis points (500 = 5%, RTP 95%). Saved with every round, so old rounds stay verifiable after a change |
| `FAIR_SALT` | dev salt | Public salt; in production a future block hash announced in advance |
| `MAX_BET` / `MAX_WIN` | 15 / 75 | Limits in USDT: the largest bet per bet panel (two panels a round) and the largest payout of one bet |
| `DATABASE_URL` | — | Postgres connection. When set, data lives in Postgres; the schema is applied on start and an existing `DATA_FILE` is imported once into an empty database |
| `DATA_FILE` | data/dev-db.json | Dev storage file used without `DATABASE_URL` |
| `CRYPTO_PAY_TOKEN` | — | Crypto Pay app token (from @CryptoTestnetBot → Crypto Pay → Create App). When set, balances are USDT only: old balances are zeroed once with a ledger entry each, no free refills. Needs `DATABASE_URL` |
| `CRYPTO_PAY_NETWORK` | testnet | The server refuses to start with anything else in this build |
| `PAY_MIN_DEPOSIT` / `PAY_MIN_WITHDRAW` / `PAY_MAX_WITHDRAW_DAY` | 10 / 10 / 1000 | Limits in USDT (0 for the day limit = none) |
| `PAY_WAGER` | 2 | Withdrawals open once the turnover reaches this many times the deposits |
| `TONCENTER_API_KEY` | — | testnet key from @tonapibot (without it toncenter allows 1 request/s) |
| `ADMIN_IDS` | — | Telegram ids allowed into the admin panel, comma separated |
| `BOT_USERNAME` | — | The bot's username without `@`, for the "Log in with Telegram" button of the admin panel |
| `ADMIN_REVIEW_OVER` | 50 | Withdrawals above this (USDT) wait for an admin's approval |
| `PARTNER_SHARE` | 0.4 | Partner's share of NGR in the RevShare summary |
| `SUPPORT_BOT` | on | `0` turns the support bot off. It runs with `BOT_TOKEN` and Postgres, on the leader server only |
| `SUPPORT_CHAT_ID` | — | The operators' Telegram group (e.g. `-100…`), the bot must be in it; `/chatid@<bot>` in the group tells its id. Without it tickets go to `ADMIN_IDS` in private |
| `SUPPORT_TOPIC_ID` | — | When the operators' group has topics: the topic for tickets (`/chatid@<bot>` sent inside a topic tells its id). Empty: the General topic |
| `PARTNER_EMAIL` | partner@boomy.pro | Quoted by the partners' answers |
| `CHANNEL_URL` | — | The official Telegram channel: a button in the support menu |
| `APP_URL` | GitHub Pages | The Mini App, for the bot's Play buttons |
| `PUBLIC_URL` | — | This server's address (the Railway URL), for links to the admin panel in tickets |

## Admin panel `/admin`

An ordinary website served by this server (needs Postgres). Sign-in with the Telegram login button; only
`ADMIN_IDS` get in. One-time setup: in @BotFather, `/setdomain` for the bot → the server's domain (the
Railway URL), so the login button works there. In dev mode without `BOT_TOKEN`, any name logs in.

- Dashboard: deposits, withdrawals, GGR / NGR, turnover, ARPU by period; cash (house wallet, owed to players,
  payouts in the queue, limits); the manual withdrawal queue with the x2 wager check; anti-fraud alerts (one IP
  or one wallet on several accounts) and deposits without a code, which can be credited to a player by hand;
  RevShare summary.
- Player card (search by Telegram id, @username, name or id): totals, wager progress, IPs, wallets, histories of
  deposits / withdrawals / bets / bonuses; block, freeze the balance, credit or debit with a reason, refund a
  lost bet, notes. Every action is written to `admin_log` and listed in the card.
- Admins get a Telegram message from the bot when a withdrawal waits for review (they must have started the bot once).

## Support bot

The game bot answers players by the support model (`docs/support-model.md`): `/start` greets with Play and Support,
`/support` (or `t.me/<bot>?start=support`, the game's Menu → Support) opens the FAQ menu in Russian or English. Answers
that need a human ask for details; the player's next message becomes a ticket in the operators' chat (header with the
player, Telegram id, balance and an admin link, plus a copy of the message), and the player is told to expect an answer
within 24 hours. Operators reply to any message of the ticket and the bot copies the reply to the player; a reply
`/close` closes it. Tickets are kept in `support_tickets`. Updates come by long polling; the bot must have no webhook set
(`getUpdates` fails with 409 otherwise, the log says so).

## API

- `POST /api/auth` `{initData}` (Telegram) or `{dev}` (dev) → `{token, user, balance, mode, bot}` (`bot`: the bot username the support button opens)
- `GET /api/me` (Bearer token) → balance and last ledger entries
- `POST /api/refill` → free play-money top-up when the balance is empty, 3 per day
- `GET /api/rounds?limit=20` → finished rounds with revealed hashes and the edge each was played with (`edgeBps`)
- `GET /api/fair` → commitment, salt, edge and the formula, for independent verification
- `GET /api/pay/info` → limits, the wager progress and the last deposits and withdrawals with their statuses (USDT mode)
- `POST /api/pay/deposit` `{amount}` → opens a Crypto Pay invoice, returns `{id, url}` (the link opens it in CryptoBot)
- `POST /api/pay/withdraw` `{amount}` → queues a payout to the player's CryptoBot wallet; `review` above `ADMIN_REVIEW_OVER`
- `POST /api/pay/cancel` `{id}` → takes back a withdrawal that waits for review or its turn
- `POST /pay/webhook` → Crypto Pay's webhook (signature checked); set it in the app's settings to `<PUBLIC_URL>/pay/webhook`. A poll every few seconds backs it up
- `GET /health`

## WebSocket `/ws?token=…`

Client → server: `{t:'bet', id, amount, auto?}`, `{t:'cancel', id}`, `{t:'cashout', id}`, `{t:'ping', id}`

Server → client: `hello` (full state), `betting`, `run`, `tick`, `crash` (with the revealed hash), public `bet` / `cancel` / `cashout`,
private `balance`, `pay` (deposit paid, payout queued / under review / sent / failed / cancelled), and `ok` / `err` replies to requests by `id`.

## USDT (Crypto Pay)

Deposits: the player picks an amount, the server opens an invoice and the player pays it in CryptoBot from any
network CryptoBot takes. A paid invoice is credited once: the invoice row is switched to `paid` in the same
transaction as the ledger entry, whether the news comes by webhook or by the poll.

Withdrawals follow the support model: from 10 USDT, only once the turnover reaches 2× the deposits, never from a
blocked or frozen account; up to `ADMIN_REVIEW_OVER` they go straight out, above it an admin approves them; the player
can cancel a request until it is being sent. Payouts are transfers to the player's CryptoBot wallet by Telegram id, one
at a time, each with the spend_id `boomy-wd-<id>`: Crypto Pay never pays a spend_id twice, and a payout interrupted by
a restart is looked up before it is tried again. A short house balance keeps the payout waiting (admins get a message);
a player who never opened CryptoBot gets the money back with a note.

Setup (testnet): in @CryptoTestnetBot → Crypto Pay → Create App, copy the token into `CRYPTO_PAY_TOKEN`, set the
webhook to `<PUBLIC_URL>/pay/webhook`, and top the app's balance up with test USDT so payouts can go out.

## Fairness

Round `n` uses hash `c[L-n]` of a chain `c[i+1] = sha256(c[i])`. Only `c[L]` (the commitment) is published up front.
After round `n` its hash is revealed; hashing it `n` times must give the commitment.

```
h     = first 52 bits of HMAC-SHA256(key = salt, message = round hash)
crash = max(1.00, floor((10000 - edgeBps) * 2^52 / (100 * (2^52 - h))) / 100)
```

`P(crash ≥ x) = (1 - edge) / x`, so every cash-out target returns `1 - edge` on average (95% at the default 5% edge).
Rounds saved before the edge was stored per round were played at 3%.

## What is not here yet

Moving coins/skins/quests from the device to the server,
real online counter, real money (Crypto Pay mainnet, only after the legal review).
