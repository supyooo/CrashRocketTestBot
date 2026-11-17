-- USDT through Crypto Pay (src/pay). Safe to run again. The TON tables stay for history; nothing writes to them now.

-- deposits: one invoice per request; 'paid' is set in the same transaction as the ledger entry
CREATE TABLE IF NOT EXISTS pay_invoices (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  invoice_id  BIGINT UNIQUE,                      -- Crypto Pay's id, once the invoice is created
  amount      BIGINT NOT NULL CHECK (amount > 0), -- units (1 USDT = 1 000 000)
  status      TEXT NOT NULL CHECK (status IN ('creating', 'active', 'paid', 'expired', 'failed')),
  url         TEXT,                               -- opens the invoice in CryptoBot
  fee         BIGINT,                             -- Crypto Pay's fee on it, when paid
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS pay_invoices_user ON pay_invoices (user_id, id DESC);
CREATE INDEX IF NOT EXISTS pay_invoices_open ON pay_invoices (status) WHERE status = 'active';

-- withdrawals: transfers to the player's CryptoBot wallet; spend_id 'boomy-wd-<id>' makes each one idempotent
CREATE TABLE IF NOT EXISTS pay_withdrawals (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  tg_id        BIGINT NOT NULL,
  amount       BIGINT NOT NULL CHECK (amount > 0),
  status       TEXT NOT NULL CHECK (status IN ('review', 'pending', 'sending', 'sent', 'failed', 'rejected', 'cancelled')),
  transfer_id  BIGINT,
  attempts     INT NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pay_withdrawals_user ON pay_withdrawals (user_id, id DESC);
CREATE INDEX IF NOT EXISTS pay_withdrawals_open ON pay_withdrawals (status) WHERE status IN ('review', 'pending', 'sending');
