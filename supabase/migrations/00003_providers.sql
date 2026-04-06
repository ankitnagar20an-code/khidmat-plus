-- ============================================
-- Migration: 00003_providers
-- Purpose: Provider entities, profiles, verification, areas, availability
-- ============================================

-- ---- providers ----
-- Provider operational state, linked to a user
CREATE TABLE public.providers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status                provider_status NOT NULL DEFAULT 'pending_onboarding',
  is_instant_book       boolean NOT NULL DEFAULT false,
  commission_rate_bps   integer NOT NULL DEFAULT 2000, -- 20.00% = 2000 basis points
  rating_avg            numeric(3,2) NOT NULL DEFAULT 0.00,
  rating_count          integer NOT NULL DEFAULT 0,
  reliability_score     numeric(5,2) NOT NULL DEFAULT 100.00,
  total_bookings        integer NOT NULL DEFAULT 0,
  total_cancellations   integer NOT NULL DEFAULT 0,
  total_no_shows        integer NOT NULL DEFAULT 0,
  onboarded_at          timestamptz,
  suspended_at          timestamptz,
  suspension_reason     text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_providers_status ON providers(status);
CREATE INDEX idx_providers_user ON providers(user_id);
CREATE INDEX idx_providers_active ON providers(id) WHERE status = 'active';

CREATE TRIGGER set_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- provider_profiles ----
-- Public-facing provider profile info
CREATE TABLE public.provider_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         uuid NOT NULL UNIQUE REFERENCES providers(id) ON DELETE CASCADE,
  full_name           text NOT NULL,
  display_name        text NOT NULL,
  bio                 text,
  avatar_url          text,
  cover_image_url     text,
  years_experience    integer CHECK (years_experience >= 0),
  certifications      jsonb NOT NULL DEFAULT '[]'::jsonb,
  languages           text[] NOT NULL DEFAULT ARRAY['en', 'ar'],
  city                text NOT NULL,
  timezone            text NOT NULL DEFAULT 'Asia/Dubai',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_provider_profiles_updated_at
  BEFORE UPDATE ON provider_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- provider_verifications ----
-- KYC and verification document tracking
CREATE TABLE public.provider_verifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  document_type     text NOT NULL CHECK (document_type IN (
    'national_id', 'emirates_id', 'passport', 'professional_license',
    'certification', 'background_check', 'insurance'
  )),
  document_url      text NOT NULL,
  status            verification_status NOT NULL DEFAULT 'pending',
  reviewed_by       uuid REFERENCES users(id),
  reviewed_at       timestamptz,
  rejection_reason  text,
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pv_provider ON provider_verifications(provider_id);
CREATE INDEX idx_pv_status ON provider_verifications(status);
CREATE INDEX idx_pv_expiry ON provider_verifications(expires_at)
  WHERE status = 'approved' AND expires_at IS NOT NULL;

CREATE TRIGGER set_pv_updated_at
  BEFORE UPDATE ON provider_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- provider_service_areas ----
-- Geographic areas where provider operates
CREATE TABLE public.provider_service_areas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  city          text NOT NULL,
  district      text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, city, district)
);

CREATE INDEX idx_psa_provider ON provider_service_areas(provider_id);
CREATE INDEX idx_psa_city ON provider_service_areas(city) WHERE is_active = true;

-- ---- provider_availability_rules ----
-- Recurring weekly windows
CREATE TABLE public.provider_availability_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week   day_of_week NOT NULL,
  start_time    time NOT NULL,    -- local time, e.g. '09:00'
  end_time      time NOT NULL,    -- local time, e.g. '17:00'
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_availability_range CHECK (end_time > start_time)
);

CREATE INDEX idx_par_provider ON provider_availability_rules(provider_id);
CREATE UNIQUE INDEX idx_par_no_dup ON provider_availability_rules(
  provider_id, day_of_week, start_time, end_time
) WHERE is_active = true;

CREATE TRIGGER set_par_updated_at
  BEFORE UPDATE ON provider_availability_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- provider_blocked_slots ----
-- Explicit date/time ranges when provider is unavailable
CREATE TABLE public.provider_blocked_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  start_time    timestamptz NOT NULL,
  end_time      timestamptz NOT NULL,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_block_range CHECK (end_time > start_time)
);

CREATE INDEX idx_pbs_provider_time ON provider_blocked_slots(
  provider_id, start_time, end_time
);
