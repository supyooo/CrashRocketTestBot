-- Support bot (src/support): the FAQ menu state of each Telegram user and the tickets passed to operators.

-- one row per Telegram user who wrote to the bot
CREATE TABLE IF NOT EXISTS support_users (
  tg_id       BIGINT PRIMARY KEY,
  lang        TEXT NOT NULL DEFAULT 'ru',
  awaiting    TEXT,                          -- FAQ node whose answer waits for the player's message (it becomes a ticket)
  ticket_id   INT,                           -- the player's current ticket: their next messages go to it
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id          SERIAL PRIMARY KEY,
  tg_id       BIGINT NOT NULL,
  uid         TEXT NOT NULL,                 -- game user id ('tg:<id>'); the player may not have opened the game yet
  topic       TEXT NOT NULL,                 -- FAQ node id
  status      TEXT NOT NULL DEFAULT 'open',  -- open | answered | closed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_user ON support_tickets (uid, id DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status ON support_tickets (status, id DESC);

-- every message of a ticket in an operators' chat: the header, the player's messages copied there, the operators' replies.
-- An operator answers by replying to any of them; (chat_id, msg_id) finds the ticket.
CREATE TABLE IF NOT EXISTS support_messages (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id   INT NOT NULL REFERENCES support_tickets (id),
  kind        TEXT NOT NULL,                 -- head | in (from the player) | out (an operator's reply)
  chat_id     BIGINT NOT NULL,               -- the operators' chat
  msg_id      BIGINT NOT NULL,               -- the message there
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS support_messages_chat ON support_messages (chat_id, msg_id);
