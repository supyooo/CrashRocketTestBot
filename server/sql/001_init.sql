-- Postgres schema for production. The dev server keeps the same data in a JSON file (src/store/store.ts);
-- a PgStore implementing the same Store interface will use these tables.
-- Money is BIGINT micro-units (1 TON = 1 000 000), never floats.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,              -- 'tg:<telegram id>' (or 'dev:<name>' in dev)
  tg_id       BIGINT UNIQUE,
  name        TEXT NOT NULL,
  username    TEXT,
  lang        TEXT,
  ref_by      TEXT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- current balance, changed only together with a ledger row in the same transaction
CREATE TABLE accounts (
  user_id  TEXT PRIMARY KEY REFERENCES users(id),
  balance  BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0)
);

-- every balance movement; ref makes each operation idempotent
CREATE TABLE ledger (
  id       BIGSERIAL PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id),
  delta    BIGINT NOT NULL,
  balance  BIGINT NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('grant', 'bet', 'win', 'refund')),
  ref      TEXT NOT NULL UNIQUE,
  at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_user_at ON ledger (user_id, at DESC);

-- one hash chain at a time; seed never leaves the server
CREATE TABLE fair_chains (
  id          SERIAL PRIMARY KEY,
  seed        TEXT NOT NULL,
  commitment  TEXT NOT NULL UNIQUE,
  length      INT NOT NULL,
  next_no     INT NOT NULL,
  salt        TEXT NOT NULL,
  edge_bps    INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rounds (
  chain_id    INT NOT NULL REFERENCES fair_chains(id),
  no          INT NOT NULL,
  crash_x100  INT NOT NULL,
  hash        TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL,
  crashed_at  TIMESTAMPTZ,
  PRIMARY KEY (chain_id, no)
);

CREATE TABLE bets (
  id          BIGSERIAL PRIMARY KEY,
  chain_id    INT NOT NULL,
  round_no    INT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id),
  amount      BIGINT NOT NULL CHECK (amount > 0),
  auto_x100   INT,
  cash_x100   INT,
  payout      BIGINT,
  status      TEXT NOT NULL CHECK (status IN ('open', 'won', 'lost', 'cancelled', 'refunded')),
  ref         TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (chain_id, round_no) REFERENCES rounds(chain_id, no) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX bets_user ON bets (user_id, created_at DESC);
CREATE INDEX bets_open ON bets (status) WHERE status = 'open';
