-- ============================================
-- Migration: 00005_addresses
-- Purpose: Customer saved addresses for service delivery
-- ============================================

CREATE TABLE public.addresses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           text NOT NULL DEFAULT 'Home' CHECK (label IN ('Home', 'Office', 'Other')),
  address_line1   text NOT NULL,
  address_line2   text,
  city            text NOT NULL,
  district        text,
  building        text,
  floor           text,
  apartment       text,
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  instructions    text, -- delivery/access instructions for provider
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

CREATE TRIGGER set_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Ensure only one default address per user
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE addresses
    SET is_default = false, updated_at = now()
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER single_default_address
  AFTER INSERT OR UPDATE OF is_default ON addresses
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_address();
