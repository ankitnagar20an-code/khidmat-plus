-- ============================================
-- Migration: 00006_bookings
-- Purpose: Core booking table, status history, slot locks
-- ============================================

-- ---- bookings ----
CREATE TABLE public.bookings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number        text NOT NULL UNIQUE, -- human-readable: KH-20260406-A1B2
  customer_id           uuid NOT NULL REFERENCES users(id),
  provider_id           uuid REFERENCES providers(id),
  service_id            uuid NOT NULL REFERENCES services(id),
  variant_id            uuid REFERENCES service_variants(id),
  address_id            uuid REFERENCES addresses(id),

  -- Time
  start_time            timestamptz NOT NULL,
  end_time              timestamptz NOT NULL,
  buffer_minutes        integer NOT NULL DEFAULT 15,
  timezone              text NOT NULL DEFAULT 'Asia/Dubai',

  -- Money (all in fils — smallest currency unit)
  service_price_fils    integer NOT NULL CHECK (service_price_fils >= 0),
  discount_fils         integer NOT NULL DEFAULT 0 CHECK (discount_fils >= 0),
  tax_fils              integer NOT NULL DEFAULT 0 CHECK (tax_fils >= 0),
  total_fils            integer NOT NULL CHECK (total_fils >= 0),
  platform_fee_fils     integer NOT NULL DEFAULT 0 CHECK (platform_fee_fils >= 0),
  provider_payout_fils  integer NOT NULL DEFAULT 0 CHECK (provider_payout_fils >= 0),

  -- State
  status                booking_status NOT NULL DEFAULT 'draft',
  is_instant_book       boolean NOT NULL DEFAULT false,
  is_online             boolean NOT NULL DEFAULT false,
  cancellation_reason   text,
  cancelled_by          uuid REFERENCES users(id),
  cancelled_at          timestamptz,
  completed_at          timestamptz,
  no_show_reported_by   uuid REFERENCES users(id),

  -- Coupon
  coupon_id             uuid,

  -- Idempotency
  idempotency_key       text NOT NULL UNIQUE,

  -- Metadata
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_booking_time CHECK (end_time > start_time),
  CONSTRAINT valid_money CHECK (
    total_fils = service_price_fils - discount_fils + tax_fils
  )
);

CREATE INDEX idx_bookings_customer ON bookings(customer_id, created_at DESC);
CREATE INDEX idx_bookings_provider ON bookings(provider_id, start_time)
  WHERE provider_id IS NOT NULL;
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_time ON bookings(start_time, end_time);
CREATE INDEX idx_bookings_number ON bookings(booking_number);

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- Prevent double-booking for same provider ----
CREATE OR REPLACE FUNCTION check_no_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.provider_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only check for active booking statuses
  IF NEW.status IN (
    'cancelled_by_customer', 'cancelled_by_provider', 'cancelled_by_admin',
    'refunded', 'payment_failed', 'draft'
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE provider_id = NEW.provider_id
      AND id != NEW.id
      AND status NOT IN (
        'cancelled_by_customer', 'cancelled_by_provider', 'cancelled_by_admin',
        'refunded', 'payment_failed', 'draft'
      )
      AND tstzrange(
        start_time,
        end_time + make_interval(mins => buffer_minutes)
      ) && tstzrange(
        NEW.start_time,
        NEW.end_time + make_interval(mins => NEW.buffer_minutes)
      )
  ) THEN
    RAISE EXCEPTION 'BOOKING_OVERLAP: Provider already has a booking in this time range'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_double_booking
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_no_booking_overlap();

-- ---- Booking number generator ----
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS text AS $$
DECLARE
  _date_part text;
  _rand_part text;
BEGIN
  _date_part := to_char(now() AT TIME ZONE 'Asia/Dubai', 'YYYYMMDD');
  _rand_part := upper(substring(md5(random()::text) from 1 for 4));
  RETURN 'KH-' || _date_part || '-' || _rand_part;
END;
$$ LANGUAGE plpgsql;

-- ---- booking_status_history ----
-- Full audit trail of every status transition
CREATE TABLE public.booking_status_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status   booking_status,
  to_status     booking_status NOT NULL,
  changed_by    uuid REFERENCES users(id), -- NULL for system actions
  reason        text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bsh_booking ON booking_status_history(booking_id, created_at);

-- Auto-track status changes
CREATE OR REPLACE FUNCTION track_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO booking_status_history (booking_id, from_status, to_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_booking_status_change
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION track_booking_status_change();

-- ---- booking_slot_locks ----
-- Temporary reservation to prevent double-booking during checkout
CREATE TABLE public.booking_slot_locks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id   uuid REFERENCES providers(id),
  start_time    timestamptz NOT NULL,
  end_time      timestamptz NOT NULL,
  locked_by     uuid NOT NULL REFERENCES users(id),
  expires_at    timestamptz NOT NULL, -- typically now() + 10 minutes
  released_at   timestamptz,          -- set when lock is released
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bsl_provider_time ON booking_slot_locks(
  provider_id, start_time, end_time
) WHERE released_at IS NULL;

CREATE INDEX idx_bsl_expires ON booking_slot_locks(expires_at)
  WHERE released_at IS NULL;

CREATE INDEX idx_bsl_booking ON booking_slot_locks(booking_id);
