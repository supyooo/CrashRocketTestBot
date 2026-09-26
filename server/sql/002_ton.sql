-- TON gateway (test TON). Safe to run again.

-- ledger kinds for deposits, withdrawals and the one-time reset of old play money
ALTER TABLE ledger DROP CONSTRAINT IF EXISTS ledger_kind_check;
ALTER TABLE ledger ADD CONSTRAINT ledger_kind_check CHECK (kind IN ('grant', 'bet', 'win', 'refund', 'deposit', 'withdraw', 'adjust'));

-- each player's deposit comment, and the wallets they have deposited from (the only allowed payout targets)
CREATE TABLE IF NOT EXISTS ton_accounts (
  user_id       TEXT PRIMARY KEY REFERENCES users(id),
  deposit_code  TEXT NOT NULL UNIQUE,
  addresses     TEXT[] NOT NULL DEFAULT '{}'      -- raw form 0:abcd…
);

-- incoming transfers seen on the house wallet, credited or not (unknown comment, too small)
CREATE TABLE IF NOT EXISTS ton_deposits (
  tx_hash     TEXT PRIMARY KEY,
  lt          NUMERIC NOT NULL,
  user_id     TEXT REFERENCES users(id),
  source      TEXT NOT NULL,
  nano        NUMERIC NOT NULL,
  comment     TEXT,
  status      TEXT NOT NULL CHECK (status IN ('credited', 'unmatched', 'too_small')),
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ton_deposits_user ON ton_deposits (user_id, at DESC);

-- payouts; `seqno` is written before sending, so a resend after a crash can never pay twice
CREATE TABLE IF NOT EXISTS ton_withdrawals (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  amount      BIGINT NOT NULL CHECK (amount > 0),   -- units (1 TON = 1 000 000)
  address     TEXT NOT NULL,                        -- raw form
  status      TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  seqno       INT,
  attempts    INT NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ton_withdrawals_user ON ton_withdrawals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ton_withdrawals_open ON ton_withdrawals (status) WHERE status IN ('pending', 'sending');
