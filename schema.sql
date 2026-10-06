CREATE TABLE IF NOT EXISTS equipment (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  location TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id            TEXT PRIMARY KEY,
  equipment_id  TEXT NOT NULL REFERENCES equipment(id),
  borrower_name TEXT NOT NULL,
  start_at      TEXT NOT NULL,
  end_at        TEXT NOT NULL,
  purpose       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (start_at < end_at)
);

CREATE INDEX IF NOT EXISTS idx_bookings_equipment_time
  ON bookings (equipment_id, start_at, end_at);

INSERT OR IGNORE INTO equipment VALUES
  ('eq-1', 'Projector A', 'Building 1'),
  ('eq-2', 'Camera Canon R6', 'Media Lab'),
  ('eq-3', 'Meeting Room 201', 'Building 2');