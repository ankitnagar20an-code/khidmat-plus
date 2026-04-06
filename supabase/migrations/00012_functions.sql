-- ============================================
-- Migration: 00012_functions
-- Purpose: Helper functions for RLS policies and business logic
-- ============================================

-- Get current user's role from JWT app_metadata
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT coalesce(
    auth.jwt()->'app_metadata'->>'role',
    'customer'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is admin or ops_manager
CREATE OR REPLACE FUNCTION public.is_admin_or_ops()
RETURNS boolean AS $$
  SELECT public.current_user_role() IN ('admin', 'ops_manager');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is admin only
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT public.current_user_role() = 'admin';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get provider_id for current authenticated user (NULL if not a provider)
CREATE OR REPLACE FUNCTION public.current_provider_id()
RETURNS uuid AS $$
  SELECT id FROM public.providers WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Calculate cancellation refund percentage based on hours until start
CREATE OR REPLACE FUNCTION public.calc_refund_percent(
  p_start_time timestamptz,
  p_cancelled_by_role text DEFAULT 'customer'
)
RETURNS integer AS $$
DECLARE
  hours_until_start numeric;
BEGIN
  -- Provider cancellation always gets full refund for customer
  IF p_cancelled_by_role IN ('provider', 'admin') THEN
    RETURN 100;
  END IF;

  hours_until_start := EXTRACT(EPOCH FROM (p_start_time - now())) / 3600.0;

  IF hours_until_start > 24 THEN RETURN 100;
  ELSIF hours_until_start > 12 THEN RETURN 50;
  ELSIF hours_until_start > 6 THEN RETURN 25;
  ELSE RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Validate booking status transition
CREATE OR REPLACE FUNCTION public.is_valid_booking_transition(
  p_from booking_status,
  p_to booking_status
)
RETURNS boolean AS $$
BEGIN
  RETURN CASE p_from
    WHEN 'draft' THEN p_to IN ('slot_locked', 'cancelled_by_customer')
    WHEN 'slot_locked' THEN p_to IN ('payment_pending', 'draft')
    WHEN 'payment_pending' THEN p_to IN ('confirmed', 'payment_failed')
    WHEN 'payment_failed' THEN p_to IN ('slot_locked', 'cancelled_by_customer')
    WHEN 'confirmed' THEN p_to IN ('provider_assigned', 'cancelled_by_customer', 'cancelled_by_admin')
    WHEN 'provider_assigned' THEN p_to IN ('provider_accepted', 'confirmed', 'cancelled_by_provider', 'cancelled_by_customer', 'cancelled_by_admin')
    WHEN 'provider_accepted' THEN p_to IN ('in_progress', 'cancelled_by_provider', 'cancelled_by_customer', 'cancelled_by_admin')
    WHEN 'in_progress' THEN p_to IN ('completed', 'no_show', 'disputed')
    WHEN 'completed' THEN p_to IN ('disputed')
    WHEN 'no_show' THEN p_to IN ('disputed', 'refunded')
    WHEN 'disputed' THEN p_to IN ('refunded', 'completed')
    WHEN 'cancelled_by_customer' THEN p_to IN ('refunded')
    WHEN 'cancelled_by_provider' THEN p_to IN ('confirmed', 'refunded')
    WHEN 'cancelled_by_admin' THEN p_to IN ('refunded')
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Enforce valid booking status transitions
CREATE OR REPLACE FUNCTION enforce_booking_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT public.is_valid_booking_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: Cannot transition booking from % to %',
        OLD.status, NEW.status
        USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_booking_transition
  BEFORE UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_booking_transition();
