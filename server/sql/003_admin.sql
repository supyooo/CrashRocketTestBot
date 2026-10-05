-- Admin panel. Safe to run again.

-- every admin action, also shown in the player card as "interactions"
CREATE TABLE IF NOT EXISTS admin_log (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    TEXT NOT NULL,                 -- 'tg:<id>' of the admin
  admin_name  TEXT NOT NULL,
  action      TEXT NOT NULL,                 -- approve, reject, attach, block, unblock, freeze, unfreeze, adjust, note
  user_id     TEXT,                          -- the player it concerns, if any
  data        JSONB NOT NULL DEFAULT '{}',
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_log_user ON admin_log (user_id, id DESC);

-- restrictions on a player: blocked = no play, no withdrawals; frozen = balance cannot leave (no withdrawals)
CREATE TABLE IF NOT EXISTS user_flags (
  user_id     TEXT PRIMARY KEY REFERENCES users(id),
  blocked     BOOLEAN NOT NULL DEFAULT false,
  frozen      BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- sign-ins with the address they came from, for the anti-fraud alerts (same IP on several accounts)
CREATE TABLE IF NOT EXISTS logins (
  user_id  TEXT NOT NULL REFERENCES users(id),
  ip       TEXT NOT NULL,
  at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ip)
);
CREATE INDEX IF NOT EXISTS logins_ip ON logins (ip);

-- withdrawals above the review threshold wait for an admin; a rejected one is refunded
ALTER TABLE ton_withdrawals DROP CONSTRAINT IF EXISTS ton_withdrawals_status_check;
ALTER TABLE ton_withdrawals ADD CONSTRAINT ton_withdrawals_status_check CHECK (status IN ('review', 'pending', 'sending', 'sent', 'failed', 'rejected'));
DROP INDEX IF EXISTS ton_withdrawals_open;
CREATE INDEX IF NOT EXISTS ton_withdrawals_open2 ON ton_withdrawals (status) WHERE status IN ('review', 'pending', 'sending');

-- deposits can be matched to a player by hand
ALTER TABLE ton_deposits DROP CONSTRAINT IF EXISTS ton_deposits_status_check;
ALTER TABLE ton_deposits ADD CONSTRAINT ton_deposits_status_check CHECK (status IN ('credited', 'unmatched', 'too_small', 'attached'));

-- stats by period
CREATE INDEX IF NOT EXISTS ledger_kind_at ON ledger (kind, at);
