-- ============================================
-- Migration: 00009_support
-- Purpose: Support tickets, admin notes, coupons
-- ============================================

-- ---- support_tickets ----
CREATE TABLE public.support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid REFERENCES bookings(id),
  created_by      uuid NOT NULL REFERENCES users(id),
  assigned_to     uuid REFERENCES users(id),
  status          ticket_status NOT NULL DEFAULT 'open',
  priority        integer NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  subject         text NOT NULL,
  description     text NOT NULL,
  category        text CHECK (category IN (
    'booking_issue', 'payment', 'provider_complaint', 'customer_complaint',
    'refund_request', 'technical', 'general', 'safety'
  )),
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_st_status ON support_tickets(status);
CREATE INDEX idx_st_priority ON support_tickets(priority, created_at)
  WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_st_booking ON support_tickets(booking_id)
  WHERE booking_id IS NOT NULL;
CREATE INDEX idx_st_assigned ON support_tickets(assigned_to)
  WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_st_created_by ON support_tickets(created_by);

CREATE TRIGGER set_st_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- admin_notes ----
-- Internal notes on any entity
CREATE TABLE public.admin_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL CHECK (entity_type IN (
    'booking', 'provider', 'user', 'ticket', 'payment', 'payout'
  )),
  entity_id     uuid NOT NULL,
  author_id     uuid NOT NULL REFERENCES users(id),
  note          text NOT NULL,
  is_internal   boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_an_entity ON admin_notes(entity_type, entity_id, created_at DESC);

-- ---- coupons ----
CREATE TABLE public.coupons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text NOT NULL UNIQUE,
  description           text,
  discount_type         text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value        integer NOT NULL CHECK (discount_value > 0),
  max_discount_fils     integer, -- cap for percentage discounts
  min_order_fils        integer NOT NULL DEFAULT 0,
  usage_limit           integer, -- NULL = unlimited
  usage_count           integer NOT NULL DEFAULT 0,
  per_user_limit        integer NOT NULL DEFAULT 1,
  valid_from            timestamptz NOT NULL,
  valid_until           timestamptz NOT NULL,
  applicable_services   uuid[],    -- NULL = all services
  applicable_categories uuid[],    -- NULL = all categories
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_coupon_period CHECK (valid_until > valid_from)
);

CREATE INDEX idx_coupons_code ON coupons(code) WHERE is_active = true;
CREATE INDEX idx_coupons_active ON coupons(valid_from, valid_until)
  WHERE is_active = true;

CREATE TRIGGER set_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- coupon_usages ----
CREATE TABLE public.coupon_usages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   uuid NOT NULL REFERENCES coupons(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  booking_id  uuid NOT NULL REFERENCES bookings(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, booking_id)
);

CREATE INDEX idx_cu_coupon_user ON coupon_usages(coupon_id, user_id);
