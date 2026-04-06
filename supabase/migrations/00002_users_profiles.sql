-- ============================================
-- Migration: 00002_users_profiles
-- Purpose: Core user identity and customer profiles
-- ============================================

-- Trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- users ----
-- Extends Supabase auth.users with role and app-level fields
CREATE TABLE public.users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'customer',
  phone         text,
  email         text,
  is_active     boolean NOT NULL DEFAULT true,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_active ON users(id) WHERE is_active = true AND deleted_at IS NULL;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- user_profiles ----
-- Customer-facing profile data
CREATE TABLE public.user_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name           text NOT NULL,
  display_name        text,
  avatar_url          text,
  date_of_birth       date,
  gender              text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  preferred_language  text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ar')),
  city                text,
  timezone            text NOT NULL DEFAULT 'Asia/Dubai',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_up_user ON user_profiles(user_id);

CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- Auto-create user + profile on auth signup ----
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role user_role;
  _name text;
BEGIN
  -- Read role from metadata, default to customer
  _role := coalesce(
    (NEW.raw_app_meta_data->>'role')::user_role,
    'customer'
  );

  -- Read name from metadata
  _name := coalesce(
    NEW.raw_user_meta_data->>'full_name',
    split_part(coalesce(NEW.email, NEW.phone, 'User'), '@', 1)
  );

  -- Create public.users row
  INSERT INTO public.users (id, role, phone, email)
  VALUES (
    NEW.id,
    _role,
    NEW.phone,
    NEW.email
  );

  -- Create profile
  INSERT INTO public.user_profiles (user_id, full_name, display_name)
  VALUES (
    NEW.id,
    _name,
    _name
  );

  -- Ensure role is in app_metadata for JWT claims
  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', _role::text)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
