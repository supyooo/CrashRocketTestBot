-- Crash Rocket schema. Applied automatically on start (safe to run again).
-- Money is BIGINT micro-units (1 TON = 1 000 000), never floats.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,              -- 'tg:<telegram id>' (or 'dev:<name>' in dev)
  tg_id       BIGINT UNIQUE,
  name        TEXT NOT NULL,
  username    TEXT,
  lang        TEXT,
  ref_by      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- current balance; changed only in the same transaction as its ledger row
CREATE TABLE IF NOT EXISTS accounts (
  user_id  TEXT PRIMARY KEY REFERENCES users(id),
  balance  BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0)
);

-- every balance movement; the unique ref makes each operation idempotent
CREATE TABLE IF NOT EXISTS ledger (
  id       BIGSERIAL PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id),
  delta    BIGINT NOT NULL,
  balance  BIGINT NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('grant', 'bet', 'win', 'refund')),
  ref      TEXT NOT NULL UNIQUE,
  at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_user_at ON ledger (user_id, id DESC);
CREATE INDEX IF NOT EXISTS ledger_ref_prefix ON ledger (ref text_pattern_ops);

-- finished rounds with their revealed hash and who played
CREATE TABLE IF NOT EXISTS rounds (
  commitment  TEXT NOT NULL,                 -- the hash chain this round belongs to
  no          INT NOT NULL,
  crash_x100  INT NOT NULL,
  hash        TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL,
  bets        JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (commitment, no)
);
CREATE INDEX IF NOT EXISTS rounds_recent ON rounds (started_at DESC);

-- small server state: the hash chain (its seed never leaves the server) and the round in progress
CREATE TABLE IF NOT EXISTS kv (
  key    TEXT PRIMARY KEY,
  value  JSONB NOT NULL
);
