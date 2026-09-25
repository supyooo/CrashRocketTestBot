# Crash Rocket server

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
| `HOUSE_EDGE_BPS` | 300 | House edge, basis points (300 = 3%) |
| `FAIR_SALT` | dev salt | Public salt; in production a future block hash announced in advance |
| `MAX_BET` / `MAX_WIN` | 1000 / 10000 | Limits in play TON |
| `DATABASE_URL` | — | Postgres connection. When set, data lives in Postgres; the schema is applied on start and an existing `DATA_FILE` is imported once into an empty database |
| `DATA_FILE` | data/dev-db.json | Dev storage file used without `DATABASE_URL` |

## API

- `POST /api/auth` `{initData}` (Telegram) or `{dev}` (dev) → `{token, user, balance}`
- `GET /api/me` (Bearer token) → balance and last ledger entries
- `POST /api/refill` → free play-money top-up when the balance is empty, 3 per day
- `GET /api/rounds?limit=20` → finished rounds with revealed hashes
- `GET /api/fair` → commitment, salt, edge and the formula, for independent verification
- `GET /health`

## WebSocket `/ws?token=…`

Client → server: `{t:'bet', id, amount, auto?}`, `{t:'cancel', id}`, `{t:'cashout', id}`, `{t:'ping', id}`

Server → client: `hello` (full state), `betting`, `run`, `tick`, `crash` (with the revealed hash), public `bet` / `cancel` / `cashout`,
private `balance`, and `ok` / `err` replies to requests by `id`.

## Fairness

Round `n` uses hash `c[L-n]` of a chain `c[i+1] = sha256(c[i])`. Only `c[L]` (the commitment) is published up front.
After round `n` its hash is revealed; hashing it `n` times must give the commitment.

```
h     = first 52 bits of HMAC-SHA256(key = salt, message = round hash)
crash = max(1.00, floor((10000 - edgeBps) * 2^52 / (100 * (2^52 - h))) / 100)
```

`P(crash ≥ x) = (1 - edge) / x`, so every cash-out target returns `1 - edge` on average.

## What is not here yet

Telegram bot process, moving coins/skins/quests from the device to the server,
real online counter, deposits and withdrawals (last stage, after the legal review).
