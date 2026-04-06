-- ============================================
-- Migration: 00013_rls_policies
-- Purpose: Row Level Security for all tables
-- ============================================

-- ========== USERS ==========
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON users FOR SELECT
  USING (id = auth.uid());
CREATE POLICY users_select_admin ON users FOR SELECT
  USING (is_admin_or_ops());
CREATE POLICY users_update_own ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ========== USER_PROFILES ==========
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY up_select_own ON user_profiles FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY up_select_admin ON user_profiles FOR SELECT
  USING (is_admin_or_ops());
CREATE POLICY up_update_own ON user_profiles FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY up_insert_own ON user_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ========== PROVIDERS ==========
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Provider reads own record
CREATE POLICY providers_select_own ON providers FOR SELECT
  USING (user_id = auth.uid());
-- Customers can see active providers for discovery
CREATE POLICY providers_select_active ON providers FOR SELECT
  USING (status = 'active');
-- Admins see all
CREATE POLICY providers_select_admin ON providers FOR SELECT
  USING (is_admin_or_ops());
-- Provider can update limited fields on own record
CREATE POLICY providers_update_own ON providers FOR UPDATE
  USING (user_id = auth.uid());

-- ========== PROVIDER_PROFILES ==========
ALTER TABLE provider_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY pp_select_public ON provider_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM providers WHERE providers.id = provider_profiles.provider_id AND providers.status = 'active'
    )
  );
CREATE POLICY pp_select_own ON provider_profiles FOR SELECT
  USING (
    provider_id = current_provider_id()
  );
CREATE POLICY pp_select_admin ON provider_profiles FOR SELECT
  USING (is_admin_or_ops());
CREATE POLICY pp_update_own ON provider_profiles FOR UPDATE
  USING (provider_id = current_provider_id());
CREATE POLICY pp_insert_own ON provider_profiles FOR INSERT
  WITH CHECK (provider_id = current_provider_id());

-- ========== PROVIDER_VERIFICATIONS ==========
ALTER TABLE provider_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY pv_select_own ON provider_verifications FOR SELECT
  USING (provider_id = current_provider_id());
CREATE POLICY pv_select_admin ON provider_verifications FOR SELECT
  USING (is_admin_or_ops());
CREATE POLICY pv_insert_own ON provider_verifications FOR INSERT
  WITH CHECK (provider_id = current_provider_id());

-- ========== PROVIDER_SERVICE_AREAS ==========
ALTER TABLE provider_service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY psa_select_public ON provider_service_areas FOR SELECT
  USING (is_active = true);
CREATE POLICY psa_select_admin ON provider_service_areas FOR SELECT
  USING (is_admin_or_ops());
CREATE POLICY psa_manage_own ON provider_service_areas FOR ALL
  USING (provider_id = current_provider_id());

-- ========== PROVIDER_AVAILABILITY_RULES ==========
ALTER TABLE provider_availability_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY par_select_public ON provider_availability_rules FOR SELECT
  USING (is_active = true);
CREATE POLICY par_manage_own ON provider_availability_rules FOR ALL
  USING (provider_id = current_provider_id());
CREATE POLICY par_select_admin ON provider_availability_rules FOR SELECT
  USING (is_admin_or_ops());

-- ========== PROVIDER_BLOCKED_SLOTS ==========
ALTER TABLE provider_blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY pbs_select_own ON provider_blocked_slots FOR SELECT
  USING (provider_id = current_provider_id());
CREATE POLICY pbs_manage_own ON provider_blocked_slots FOR ALL
  USING (provider_id = current_provider_id());
CREATE POLICY pbs_select_admin ON provider_blocked_slots FOR SELECT
  USING (is_admin_or_ops());

-- ========== SERVICE_CATEGORIES ==========
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY sc_select_active ON service_categories FOR SELECT
  USING (is_active = true);
CREATE POLICY sc_manage_admin ON service_categories FOR ALL
  USING (is_admin_or_ops());

-- ========== SERVICES ==========
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY s_select_active ON services FOR SELECT
  USING (is_active = true);
CREATE POLICY s_manage_admin ON services FOR ALL
  USING (is_admin_or_ops());

-- ========== SERVICE_VARIANTS ==========
ALTER TABLE service_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY sv_select_active ON service_variants FOR SELECT
  USING (is_active = true);
CREATE POLICY sv_manage_admin ON service_variants FOR ALL
  USING (is_admin_or_ops());

-- ========== PROVIDER_SERVICES ==========
ALTER TABLE provider_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY ps_select_public ON provider_services FOR SELECT
  USING (is_active = true AND is_approved = true);
CREATE POLICY ps_select_own ON provider_services FOR SELECT
  USING (provider_id = current_provider_id());
CREATE POLICY ps_select_admin ON provider_services FOR SELECT
  USING (is_admin_or_ops());
CREATE POLICY ps_manage_own ON provider_services FOR INSERT
  WITH CHECK (provider_id = current_provider_id());
CREATE POLICY ps_update_own ON provider_services FOR UPDATE
  USING (provider_id = current_provider_id());

-- ========== ADDRESSES ==========
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY addr_select_own ON addresses FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY addr_insert_own ON addresses FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY addr_update_own ON addresses FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY addr_delete_own ON addresses FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY addr_select_admin ON addresses FOR SELECT
  USING (is_admin_or_ops());

-- ========== BOOKINGS ==========
-- Bookings are created ONLY via edge functions (service_role bypasses RLS)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookings_select_customer ON bookings FOR SELECT
  USING (customer_id = auth.uid());
CREATE POLICY bookings_select_provider ON bookings FOR SELECT
  USING (provider_id = current_provider_id());
CREATE POLICY bookings_select_admin ON bookings FOR SELECT
  USING (is_admin_or_ops());

-- ========== BOOKING_STATUS_HISTORY ==========
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY bsh_select_via_booking ON booking_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_status_history.booking_id
      AND (bookings.customer_id = auth.uid() OR bookings.provider_id = current_provider_id())
    )
  );
CREATE POLICY bsh_select_admin ON booking_status_history FOR SELECT
  USING (is_admin_or_ops());

-- ========== BOOKING_SLOT_LOCKS ==========
ALTER TABLE booking_slot_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY bsl_select_own ON booking_slot_locks FOR SELECT
  USING (locked_by = auth.uid());
CREATE POLICY bsl_select_admin ON booking_slot_locks FOR SELECT
  USING (is_admin_or_ops());

-- ========== PAYMENTS ==========
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pay_select_customer ON payments FOR SELECT
  USING (customer_id = auth.uid());
CREATE POLICY pay_select_admin ON payments FOR SELECT
  USING (is_admin_or_ops());
-- All payment mutations via edge functions only (service_role)

-- ========== PAYOUTS ==========
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY payouts_select_own ON payouts FOR SELECT
  USING (
    provider_id = current_provider_id()
  );
CREATE POLICY payouts_select_admin ON payouts FOR SELECT
  USING (is_admin_or_ops());

-- ========== PROVIDER_WALLET_LEDGER ==========
ALTER TABLE provider_wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY pwl_select_own ON provider_wallet_ledger FOR SELECT
  USING (provider_id = current_provider_id());
CREATE POLICY pwl_select_admin ON provider_wallet_ledger FOR SELECT
  USING (is_admin_or_ops());

-- ========== REVIEWS ==========
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_select_published ON reviews FOR SELECT
  USING (is_published = true);
CREATE POLICY reviews_select_own ON reviews FOR SELECT
  USING (customer_id = auth.uid());
CREATE POLICY reviews_select_admin ON reviews FOR SELECT
  USING (is_admin_or_ops());
CREATE POLICY reviews_insert_customer ON reviews FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = reviews.booking_id
        AND bookings.customer_id = auth.uid()
        AND bookings.status = 'completed'
    )
  );

-- ========== SUPPORT_TICKETS ==========
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY st_select_own ON support_tickets FOR SELECT
  USING (created_by = auth.uid());
CREATE POLICY st_insert_own ON support_tickets FOR INSERT
  WITH CHECK (created_by = auth.uid());
CREATE POLICY st_select_admin ON support_tickets FOR SELECT
  USING (is_admin_or_ops());
CREATE POLICY st_manage_admin ON support_tickets FOR UPDATE
  USING (is_admin_or_ops());

-- ========== ADMIN_NOTES ==========
ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY an_select_admin ON admin_notes FOR SELECT
  USING (is_admin_or_ops());
CREATE POLICY an_insert_admin ON admin_notes FOR INSERT
  WITH CHECK (is_admin_or_ops() AND author_id = auth.uid());

-- ========== COUPONS ==========
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY coupons_select_active ON coupons FOR SELECT
  USING (is_active = true AND valid_from <= now() AND valid_until > now());
CREATE POLICY coupons_manage_admin ON coupons FOR ALL
  USING (is_admin_or_ops());

-- ========== COUPON_USAGES ==========
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY cu_select_own ON coupon_usages FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY cu_select_admin ON coupon_usages FOR SELECT
  USING (is_admin_or_ops());

-- ========== NOTIFICATIONS ==========
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_select_own ON notifications FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY notif_update_own ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ========== AUDIT_LOGS ==========
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY al_select_admin ON audit_logs FOR SELECT
  USING (is_admin_or_ops());
