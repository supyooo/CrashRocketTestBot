-- The house edge each round's crash point was computed with, so players can verify old rounds after the edge changes.
-- NULL: a round saved before this column existed (played at the old default, 3%).
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS edge_bps INT;
