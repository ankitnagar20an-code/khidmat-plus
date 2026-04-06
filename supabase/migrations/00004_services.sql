-- ============================================
-- Migration: 00004_services
-- Purpose: Service catalog — categories, services, variants, provider linkage
-- ============================================

-- ---- service_categories ----
CREATE TABLE public.service_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  name_ar     text,
  slug        text NOT NULL UNIQUE,
  description text,
  icon_url    text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_sc_updated_at
  BEFORE UPDATE ON service_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- services ----
CREATE TABLE public.services (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id             uuid NOT NULL REFERENCES service_categories(id),
  name                    text NOT NULL,
  name_ar                 text,
  slug                    text NOT NULL UNIQUE,
  description             text,
  short_description       text,
  image_url               text,
  base_price_fils         integer NOT NULL CHECK (base_price_fils > 0),
  base_duration_minutes   integer NOT NULL CHECK (base_duration_minutes > 0),
  buffer_minutes          integer NOT NULL DEFAULT 15 CHECK (buffer_minutes >= 0),
  is_online               boolean NOT NULL DEFAULT false,
  requires_address        boolean NOT NULL DEFAULT true,
  is_active               boolean NOT NULL DEFAULT true,
  sort_order              integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_category ON services(category_id) WHERE is_active = true;
CREATE INDEX idx_services_slug ON services(slug);
CREATE INDEX idx_services_active ON services(id) WHERE is_active = true;

CREATE TRIGGER set_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- service_variants ----
CREATE TABLE public.service_variants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id          uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name                text NOT NULL,
  name_ar             text,
  duration_minutes    integer NOT NULL CHECK (duration_minutes > 0),
  price_fils          integer NOT NULL CHECK (price_fils > 0),
  is_active           boolean NOT NULL DEFAULT true,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sv_service ON service_variants(service_id) WHERE is_active = true;

CREATE TRIGGER set_sv_updated_at
  BEFORE UPDATE ON service_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- provider_services ----
-- Which services a provider offers (with optional custom pricing)
CREATE TABLE public.provider_services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id        uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  variant_id        uuid REFERENCES service_variants(id) ON DELETE SET NULL,
  custom_price_fils integer CHECK (custom_price_fils IS NULL OR custom_price_fils > 0),
  is_approved       boolean NOT NULL DEFAULT false,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, service_id, variant_id)
);

CREATE INDEX idx_ps_provider ON provider_services(provider_id) WHERE is_active = true;
CREATE INDEX idx_ps_service ON provider_services(service_id)
  WHERE is_active = true AND is_approved = true;

CREATE TRIGGER set_ps_updated_at
  BEFORE UPDATE ON provider_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
