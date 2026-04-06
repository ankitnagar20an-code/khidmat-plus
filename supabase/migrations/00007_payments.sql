-- ============================================
-- Migration: 00007_payments
-- Purpose: Payments, payouts, provider wallet ledger
-- ============================================

-- ---- payments ----
CREATE TABLE public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          uuid NOT NULL REFERENCES bookings(id),
  customer_id         uuid NOT NULL REFERENCES users(id),
  amount_fils         integer NOT NULL CHECK (amount_fils > 0),
  currency            text NOT NULL DEFAULT 'AED',
  status              payment_status NOT NULL DEFAULT 'pending',
  payment_method      text, -- 'card', 'apple_pay', 'google_pay'
  provider_ref        text, -- external payment provider reference ID
  idempotency_key     text NOT NULL UNIQUE,
  failure_reason      text,
  paid_at             timestamptz,
  refunded_at         timestamptz,
  refund_amount_fils  integer NOT NULL DEFAULT 0 CHECK (refund_amount_fils >= 0),
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider_ref ON payments(provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX idx_payments_pending_expire ON payments(created_at)
  WHERE status = 'pending';

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- payouts ----
-- Provider payout batches
CREATE TABLE public.payouts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid NOT NULL REFERENCES providers(id),
  amount_fils     integer NOT NULL CHECK (amount_fils > 0),
  currency        text NOT NULL DEFAULT 'AED',
  status          payout_status NOT NULL DEFAULT 'pending',
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  booking_count   integer NOT NULL DEFAULT 0,
  payout_ref      text, -- external payout/transfer reference
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_payout_period CHECK (period_end > period_start)
);

CREATE INDEX idx_payouts_provider ON payouts(provider_id, created_at DESC);
CREATE INDEX idx_payouts_status ON payouts(status);

CREATE TRIGGER set_payouts_updated_at
  BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- provider_wallet_ledger ----
-- Double-entry ledger tracking every credit/debit for a provider
CREATE TABLE public.provider_wallet_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid NOT NULL REFERENCES providers(id),
  booking_id      uuid REFERENCES bookings(id),
  payout_id       uuid REFERENCES payouts(id),
  entry_type      text NOT NULL CHECK (entry_type IN (
    'earning', 'cancellation_fee', 'bonus', 'payout', 'adjustment', 'penalty'
  )),
  amount_fils     integer NOT NULL,  -- positive = credit, negative = debit
  balance_fils    integer NOT NULL,  -- running balance after this entry
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pwl_provider ON provider_wallet_ledger(provider_id, created_at DESC);
CREATE INDEX idx_pwl_booking ON provider_wallet_ledger(booking_id)
  WHERE booking_id IS NOT NULL;
CREATE INDEX idx_pwl_payout ON provider_wallet_ledger(payout_id)
  WHERE payout_id IS NOT NULL;
