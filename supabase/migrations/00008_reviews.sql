-- ============================================
-- Migration: 00008_reviews
-- Purpose: Customer reviews of completed bookings
-- ============================================

CREATE TABLE public.reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL UNIQUE REFERENCES bookings(id),
  customer_id     uuid NOT NULL REFERENCES users(id),
  provider_id     uuid NOT NULL REFERENCES providers(id),
  service_id      uuid NOT NULL REFERENCES services(id),
  rating          integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment         text,
  is_published    boolean NOT NULL DEFAULT true,
  is_flagged      boolean NOT NULL DEFAULT false,
  flag_reason     text,
  moderated_by    uuid REFERENCES users(id),
  moderated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_provider ON reviews(provider_id, created_at DESC)
  WHERE is_published = true;
CREATE INDEX idx_reviews_service ON reviews(service_id)
  WHERE is_published = true;
CREATE INDEX idx_reviews_customer ON reviews(customer_id);
CREATE INDEX idx_reviews_flagged ON reviews(id)
  WHERE is_flagged = true AND moderated_at IS NULL;

CREATE TRIGGER set_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update provider rating on review insert/update
CREATE OR REPLACE FUNCTION update_provider_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE providers
  SET
    rating_avg = (
      SELECT coalesce(avg(rating), 0)
      FROM reviews
      WHERE provider_id = NEW.provider_id AND is_published = true
    ),
    rating_count = (
      SELECT count(*)
      FROM reviews
      WHERE provider_id = NEW.provider_id AND is_published = true
    ),
    updated_at = now()
  WHERE id = NEW.provider_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OF rating, is_published ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_rating();
