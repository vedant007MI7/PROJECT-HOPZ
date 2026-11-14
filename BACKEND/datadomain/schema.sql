-- Safe to run twice: every statement is IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('rider', 'driver')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phones are stored as +<country><digits>. This trigger fixes a bare 10-digit Indian number
-- (typed by hand in the table, or by any client) into +91XXXXXXXXXX, so login always finds it.
CREATE OR REPLACE FUNCTION normalize_user_phone() RETURNS trigger AS $fn$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '[ \-().]', '', 'g');
    IF NEW.phone ~ '^[6-9][0-9]{9}$' THEN NEW.phone := '+91' || NEW.phone;
    ELSIF NEW.phone ~ '^0[6-9][0-9]{9}$' THEN NEW.phone := '+91' || substr(NEW.phone, 2);
    ELSIF NEW.phone ~ '^91[6-9][0-9]{9}$' THEN NEW.phone := '+' || NEW.phone;
    END IF;
  END IF;
  RETURN NEW;
END
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_normalize_user_phone ON users;
CREATE TRIGGER trg_normalize_user_phone BEFORE INSERT OR UPDATE OF phone ON users
  FOR EACH ROW EXECUTE FUNCTION normalize_user_phone();
-- Fix rows already stored in another format (safe to re-run).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_format;
UPDATE users SET phone = phone WHERE phone IS NOT NULL;
-- A phone number belongs to exactly one account (accounts without a phone are unaffected: NULLs never clash).
-- A real constraint, not just an index, so table editors show it as UNIQUE.
DROP INDEX IF EXISTS idx_users_phone_role;
DROP INDEX IF EXISTS idx_users_phone;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
-- Login looks phones up in this format, so reject anything that is still not a phone number.
ALTER TABLE users ADD CONSTRAINT users_phone_format CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$');

CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type        TEXT NOT NULL CHECK (vehicle_type IN ('auto', 'mini', 'sedan')),
  vehicle_model       TEXT,
  plate               TEXT,
  is_online           BOOLEAN NOT NULL DEFAULT false,
  lat                 DOUBLE PRECISION CHECK (lat BETWEEN -90 AND 90),
  lng                 DOUBLE PRECISION CHECK (lng BETWEEN -180 AND 180),
  location_updated_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_online ON driver_profiles (is_online, vehicle_type);

CREATE TABLE IF NOT EXISTS rides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id     UUID NOT NULL REFERENCES users(id),
  driver_id    UUID REFERENCES users(id),
  pickup_text  TEXT NOT NULL,
  pickup_lat   DOUBLE PRECISION NOT NULL CHECK (pickup_lat BETWEEN -90 AND 90),
  pickup_lng   DOUBLE PRECISION NOT NULL CHECK (pickup_lng BETWEEN -180 AND 180),
  drop_text    TEXT NOT NULL,
  drop_lat     DOUBLE PRECISION NOT NULL CHECK (drop_lat BETWEEN -90 AND 90),
  drop_lng     DOUBLE PRECISION NOT NULL CHECK (drop_lng BETWEEN -180 AND 180),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('auto', 'mini', 'sedan')),
  distance_km  NUMERIC(8, 2) NOT NULL CHECK (distance_km >= 0),
  fare         INTEGER NOT NULL CHECK (fare >= 0),
  status       TEXT NOT NULL DEFAULT 'requested'
               CHECK (status IN ('requested', 'accepted', 'arrived', 'started', 'completed', 'cancelled')),
  start_pin    TEXT CHECK (start_pin ~ '^[0-9]{4}$'),
  pin_attempts INTEGER NOT NULL DEFAULT 0 CHECK (pin_attempts >= 0),
  cancelled_by TEXT CHECK (cancelled_by IN ('rider', 'driver', 'system')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at  TIMESTAMPTZ,
  arrived_at   TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CHECK (driver_id <> rider_id)
);
CREATE INDEX IF NOT EXISTS idx_rides_status   ON rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_rider    ON rides (rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver   ON rides (driver_id);
-- Database-level guarantee: one active ride per driver, even if two accepts race.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rides_driver_active
  ON rides (driver_id) WHERE status IN ('accepted', 'arrived', 'started');
-- Same for riders, so a double-tap on "request" cannot create two rides.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rides_rider_active
  ON rides (rider_id) WHERE status IN ('requested', 'accepted', 'arrived', 'started');

CREATE TABLE IF NOT EXISTS ratings (
  ride_id    UUID PRIMARY KEY REFERENCES rides(id),
  stars      INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  tip        INTEGER NOT NULL DEFAULT 0 CHECK (tip >= 0),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens (user_id);

CREATE TABLE IF NOT EXISTS ride_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id    UUID NOT NULL REFERENCES rides(id),
  status     TEXT NOT NULL
             CHECK (status IN ('requested', 'accepted', 'arrived', 'started', 'completed', 'cancelled', 'declined')),
  actor_id   UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ride_events_ride  ON ride_events (ride_id);
-- Serves "rides this driver declined" in GET /drivers/requests.
CREATE INDEX IF NOT EXISTS idx_ride_events_actor ON ride_events (actor_id, status);

-- Existing databases: widen cancelled_by so unanswered requests can be auto-cancelled by the system.
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_cancelled_by_check;
ALTER TABLE rides ADD CONSTRAINT rides_cancelled_by_check CHECK (cancelled_by IN ('rider', 'driver', 'system'));

-- Payments: how a ride is paid, and one row per Razorpay order.
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_payment_method_check;
ALTER TABLE rides ADD CONSTRAINT rides_payment_method_check CHECK (payment_method IN ('cash', 'online'));
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_payment_status_check;
ALTER TABLE rides ADD CONSTRAINT rides_payment_status_check CHECK (payment_status IN ('unpaid', 'paid'));

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id             UUID NOT NULL REFERENCES rides(id),
  amount              INTEGER NOT NULL CHECK (amount > 0),            -- in paise
  currency            TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id   TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  status              TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payments_ride ON payments (ride_id);
-- A ride can be paid only once, even if two verify calls race.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_ride_paid ON payments (ride_id) WHERE status = 'paid';

-- One-time codes (password reset). Only a hash of the code is stored.
CREATE TABLE IF NOT EXISTS otp_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL DEFAULT 'password_reset',
  code_hash  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_user ON otp_codes (user_id, purpose, created_at DESC);
