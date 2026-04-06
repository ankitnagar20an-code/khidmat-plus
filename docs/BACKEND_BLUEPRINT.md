# Khidmat+ Backend Architecture Blueprint

**Version:** 1.0
**Date:** 2026-04-06
**Status:** Implementation-Ready

---

## SECTION 1: SYSTEM ARCHITECTURE

### High-Level Architecture

```
[Mobile/Web App - Next.js on Vercel]
        |
        ├── Supabase Auth (JWT sessions, role claims)
        ├── Supabase PostgREST (direct DB reads with RLS)
        ├── Supabase Edge Functions (secure mutations)
        ├── Supabase Realtime (booking status, notifications)
        ├── Supabase Storage (profile photos, KYC docs, service images)
        |
        ├── External: Payment Provider (Stripe/Tap/HyperPay via webhook)
        ├── External: SMS/WhatsApp (Twilio/MessageBird)
        ├── External: Email (Resend/SendGrid)
        └── External: Push Notifications (Firebase Cloud Messaging)
```

### Component Responsibilities

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Client** | Next.js (App Router) | UI rendering, optimistic UI, session management, Supabase client queries |
| **API Gateway** | Supabase PostgREST | Direct read queries with RLS enforcement |
| **Secure Mutations** | Supabase Edge Functions | All write operations that need business logic: booking creation, payment confirmation, provider assignment |
| **Database** | Supabase Postgres | Source of truth. All constraints, enums, triggers, and RLS policies live here |
| **Auth** | Supabase Auth | JWT issuance, role claims in `app_metadata`, email/phone OTP |
| **Realtime** | Supabase Realtime | Booking status changes, notification delivery, provider dashboard updates |
| **Storage** | Supabase Storage | Provider KYC documents, profile avatars, service images |
| **Hosting** | Vercel | Next.js hosting, preview deploys, edge middleware for auth checks |
| **CI/CD** | GitHub Actions | Lint, test, migration safety checks, deploy triggers |

### Synchronous vs Async

| Operation | Mode | Reason |
|-----------|------|--------|
| Slot lock acquisition | **Sync** | Must return lock confirmation before payment |
| Payment intent creation | **Sync** | User needs immediate redirect/confirmation |
| Payment webhook processing | **Async** | Webhook arrives independently |
| Provider assignment | **Async** | May require fallback/reallocation |
| Notification dispatch | **Async** | Never block booking flow for notification delivery |
| Payout calculation | **Async (cron)** | Batch process, not real-time |
| Review eligibility check | **Async (trigger)** | DB trigger on booking completion |
| Slot lock expiry | **Async (cron)** | Every 60s cleanup |
| Provider score recalculation | **Async (cron)** | Nightly batch |

### Webhook Integrations

| Source | Event | Handler |
|--------|-------|---------|
| Payment Provider | `payment.succeeded` | `confirm-payment` edge function |
| Payment Provider | `payment.failed` | `handle-payment-failure` edge function |
| Payment Provider | `refund.completed` | `process-refund-webhook` edge function |
| Supabase Auth | `user.created` | DB trigger to create profile |

### Notification Architecture

```
Event (DB trigger / Edge Function)
    → Insert into notifications table
    → Supabase Realtime pushes to connected clients (in-app)
    → Async queue picks up for external delivery:
        → Email (Resend)
        → SMS (Twilio)
        → WhatsApp (Twilio/MessageBird)
        → Push (FCM)
```

External notification dispatch uses a `pg_cron` or Edge Function cron that polls the `notifications` table for `channel != 'in_app'` and `sent_at IS NULL`.

### Payment Reconciliation

Payment state is reconciled via a **dual-write pattern**:
1. Edge Function creates a `payments` row with `status = 'pending'` and a unique `idempotency_key`
2. Payment provider webhook updates the row to `succeeded` or `failed`
3. A `pg_cron` job runs every 5 minutes to check for `pending` payments older than 15 minutes → marks as `expired` and releases slot locks
4. All payment mutations use `SELECT ... FOR UPDATE` on the payment row to prevent races

---

## SECTION 2: DATABASE DESIGN

### Enum Strategy

All enums are Postgres native enums. They live in a dedicated migration and are referenced by column type.

```sql
-- Roles
CREATE TYPE user_role AS ENUM ('customer', 'provider', 'admin', 'ops_manager');

-- Booking lifecycle
CREATE TYPE booking_status AS ENUM (
  'draft', 'slot_locked', 'payment_pending', 'payment_failed',
  'confirmed', 'provider_assigned', 'provider_accepted',
  'in_progress', 'completed', 'cancelled_by_customer',
  'cancelled_by_provider', 'cancelled_by_admin', 'no_show',
  'disputed', 'refunded'
);

-- Payment lifecycle
CREATE TYPE payment_status AS ENUM (
  'pending', 'processing', 'succeeded', 'failed', 'expired',
  'refund_pending', 'refunded', 'partially_refunded'
);

-- Provider lifecycle
CREATE TYPE provider_status AS ENUM (
  'pending_onboarding', 'documents_submitted', 'under_review',
  'approved', 'active', 'paused', 'suspended', 'deactivated'
);

-- Verification
CREATE TYPE verification_status AS ENUM (
  'not_submitted', 'pending', 'approved', 'rejected', 'expired'
);

-- Payout
CREATE TYPE payout_status AS ENUM (
  'pending', 'eligible', 'processing', 'completed', 'failed', 'on_hold'
);

-- Notification channel
CREATE TYPE notification_channel AS ENUM (
  'in_app', 'email', 'sms', 'whatsapp', 'push'
);

-- Day of week
CREATE TYPE day_of_week AS ENUM (
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);

-- Support ticket
CREATE TYPE ticket_status AS ENUM (
  'open', 'in_progress', 'waiting_customer', 'waiting_provider',
  'escalated', 'resolved', 'closed'
);
```

### Money Handling

All monetary values stored as `integer` in the **smallest currency unit** (fils for AED, meaning 1 AED = 100 fils). Column name convention: `amount_fils`. This avoids all floating-point issues.

### Timezone Strategy

All timestamps stored as `timestamptz` (UTC). The application layer converts for display. A `city` or `timezone` field on the service area / address determines display timezone. Middle East markets: `Asia/Dubai` (UTC+4), `Asia/Riyadh` (UTC+3).

### Booking Slot Storage

Slots stored as `start_time timestamptz` + `end_time timestamptz` on the booking. Provider availability stored as recurring rules (day + start/end time in local timezone string) plus explicit blocked ranges.

---

### TABLE DEFINITIONS

#### 1. `users` (extends Supabase auth.users)

**Purpose:** Core user identity. Supabase auth.users handles email/password/phone. This table adds role and soft-delete.

```sql
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
```

#### 2. `user_profiles`

**Purpose:** Customer-facing profile data.

```sql
CREATE TABLE public.user_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  display_name    text,
  avatar_url      text,
  date_of_birth   date,
  gender          text,
  preferred_language text NOT NULL DEFAULT 'en',
  city            text,
  timezone        text NOT NULL DEFAULT 'Asia/Dubai',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

#### 3. `providers`

**Purpose:** Provider entity linked to a user. Separate from user_profiles because a provider has operational state.

```sql
CREATE TABLE public.providers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status              provider_status NOT NULL DEFAULT 'pending_onboarding',
  is_instant_book     boolean NOT NULL DEFAULT false,
  commission_rate_bps integer NOT NULL DEFAULT 2000, -- 20.00% in basis points
  rating_avg          numeric(3,2) DEFAULT 0.00,
  rating_count        integer DEFAULT 0,
  reliability_score   numeric(5,2) DEFAULT 100.00,
  total_bookings      integer DEFAULT 0,
  total_cancellations integer DEFAULT 0,
  total_no_shows      integer DEFAULT 0,
  onboarded_at        timestamptz,
  suspended_at        timestamptz,
  suspension_reason   text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_providers_status ON providers(status);
CREATE INDEX idx_providers_user ON providers(user_id);
```

#### 4. `provider_profiles`

**Purpose:** Public-facing provider profile info.

```sql
CREATE TABLE public.provider_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid NOT NULL UNIQUE REFERENCES providers(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  display_name    text NOT NULL,
  bio             text,
  avatar_url      text,
  cover_image_url text,
  years_experience integer,
  certifications  jsonb DEFAULT '[]'::jsonb,
  languages       text[] DEFAULT ARRAY['en', 'ar'],
  city            text NOT NULL,
  timezone        text NOT NULL DEFAULT 'Asia/Dubai',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

#### 5. `provider_verifications`

**Purpose:** Track KYC and verification documents per provider.

```sql
CREATE TABLE public.provider_verifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  document_type   text NOT NULL, -- 'national_id', 'license', 'certification', 'background_check'
  document_url    text NOT NULL,
  status          verification_status NOT NULL DEFAULT 'not_submitted',
  reviewed_by     uuid REFERENCES users(id),
  reviewed_at     timestamptz,
  rejection_reason text,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pv_provider ON provider_verifications(provider_id);
CREATE INDEX idx_pv_status ON provider_verifications(status);
```

#### 6. `provider_service_areas`

**Purpose:** Geographic areas where a provider operates.

```sql
CREATE TABLE public.provider_service_areas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  city        text NOT NULL,
  district    text, -- optional finer granularity
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_psa_provider ON provider_service_areas(provider_id);
CREATE INDEX idx_psa_city ON provider_service_areas(city) WHERE is_active = true;
```

#### 7. `provider_availability_rules`

**Purpose:** Recurring weekly availability windows for a provider.

```sql
CREATE TABLE public.provider_availability_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  start_time  time NOT NULL, -- local time, e.g. '09:00'
  end_time    time NOT NULL, -- local time, e.g. '17:00'
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_par_provider ON provider_availability_rules(provider_id);
CREATE UNIQUE INDEX idx_par_unique_slot ON provider_availability_rules(provider_id, day_of_week, start_time, end_time) WHERE is_active = true;
```

#### 8. `provider_blocked_slots`

**Purpose:** Explicit date/time ranges when a provider is unavailable (vacation, personal, etc).

```sql
CREATE TABLE public.provider_blocked_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_block_range CHECK (end_time > start_time)
);

CREATE INDEX idx_pbs_provider_time ON provider_blocked_slots(provider_id, start_time, end_time);
```

#### 9. `service_categories`

**Purpose:** Top-level groupings: Health, Wellness, Fitness.

```sql
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
```

#### 10. `services`

**Purpose:** Specific services within a category (e.g., "Physiotherapy", "Deep Tissue Massage").

```sql
CREATE TABLE public.services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid NOT NULL REFERENCES service_categories(id),
  name            text NOT NULL,
  name_ar         text,
  slug            text NOT NULL UNIQUE,
  description     text,
  short_description text,
  image_url       text,
  base_price_fils integer NOT NULL,
  base_duration_minutes integer NOT NULL, -- e.g. 60
  buffer_minutes  integer NOT NULL DEFAULT 15, -- setup/cleanup/travel
  is_online       boolean NOT NULL DEFAULT false, -- video consultation
  requires_address boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_category ON services(category_id) WHERE is_active = true;
CREATE INDEX idx_services_slug ON services(slug);
```

#### 11. `service_variants`

**Purpose:** Variants of a service (e.g., 60-min vs 90-min session, single vs couple).

```sql
CREATE TABLE public.service_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name            text NOT NULL, -- '60 min', '90 min', 'Couple Session'
  name_ar         text,
  duration_minutes integer NOT NULL,
  price_fils      integer NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sv_service ON service_variants(service_id) WHERE is_active = true;
```

#### 12. `provider_services`

**Purpose:** Which services a provider is eligible/approved to offer and at what price.

```sql
CREATE TABLE public.provider_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id      uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  variant_id      uuid REFERENCES service_variants(id),
  custom_price_fils integer, -- NULL means use service base/variant price
  is_approved     boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, service_id, variant_id)
);

CREATE INDEX idx_ps_provider ON provider_services(provider_id) WHERE is_active = true;
CREATE INDEX idx_ps_service ON provider_services(service_id) WHERE is_active = true AND is_approved = true;
```

#### 13. `addresses`

**Purpose:** Customer saved addresses for service delivery.

```sql
CREATE TABLE public.addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT 'Home', -- 'Home', 'Office', 'Other'
  address_line1 text NOT NULL,
  address_line2 text,
  city        text NOT NULL,
  district    text,
  building    text,
  floor       text,
  apartment   text,
  latitude    numeric(10,7),
  longitude   numeric(10,7),
  instructions text, -- delivery/access instructions
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);
```

#### 14. `bookings`

**Purpose:** Core booking record. The central business object.

```sql
CREATE TABLE public.bookings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number      text NOT NULL UNIQUE, -- human-readable: KH-20260406-A1B2
  customer_id         uuid NOT NULL REFERENCES users(id),
  provider_id         uuid REFERENCES providers(id), -- NULL until assigned
  service_id          uuid NOT NULL REFERENCES services(id),
  variant_id          uuid REFERENCES service_variants(id),
  address_id          uuid REFERENCES addresses(id),

  -- Time
  start_time          timestamptz NOT NULL,
  end_time            timestamptz NOT NULL,
  buffer_minutes      integer NOT NULL DEFAULT 15,
  timezone            text NOT NULL DEFAULT 'Asia/Dubai',

  -- Money (fils)
  service_price_fils  integer NOT NULL,
  discount_fils       integer NOT NULL DEFAULT 0,
  tax_fils            integer NOT NULL DEFAULT 0,
  total_fils          integer NOT NULL,
  platform_fee_fils   integer NOT NULL DEFAULT 0,
  provider_payout_fils integer NOT NULL DEFAULT 0,

  -- State
  status              booking_status NOT NULL DEFAULT 'draft',
  is_instant_book     boolean NOT NULL DEFAULT false,
  is_online           boolean NOT NULL DEFAULT false,
  cancellation_reason text,
  cancelled_by        uuid REFERENCES users(id),
  cancelled_at        timestamptz,
  completed_at        timestamptz,
  no_show_reported_by uuid REFERENCES users(id),

  -- Coupon
  coupon_id           uuid,
  idempotency_key     text NOT NULL UNIQUE,

  -- Metadata
  notes               text, -- customer notes
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_booking_time CHECK (end_time > start_time),
  CONSTRAINT valid_total CHECK (total_fils >= 0)
);

CREATE INDEX idx_bookings_customer ON bookings(customer_id, created_at DESC);
CREATE INDEX idx_bookings_provider ON bookings(provider_id, start_time) WHERE provider_id IS NOT NULL;
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_time ON bookings(start_time, end_time);
CREATE INDEX idx_bookings_number ON bookings(booking_number);
```

#### 15. `booking_status_history`

**Purpose:** Full audit trail of every status transition on a booking.

```sql
CREATE TABLE public.booking_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status booking_status,
  to_status   booking_status NOT NULL,
  changed_by  uuid REFERENCES users(id), -- NULL for system actions
  reason      text,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bsh_booking ON booking_status_history(booking_id, created_at);
```

#### 16. `booking_slot_locks`

**Purpose:** Temporary reservation of a time slot before payment. Prevents double-booking during checkout.

```sql
CREATE TABLE public.booking_slot_locks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES providers(id), -- NULL if best-available
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  locked_by   uuid NOT NULL REFERENCES users(id),
  expires_at  timestamptz NOT NULL, -- lock TTL, typically now() + 10 min
  released_at timestamptz, -- set when lock is released
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bsl_provider_time ON booking_slot_locks(provider_id, start_time, end_time)
  WHERE released_at IS NULL;
CREATE INDEX idx_bsl_expires ON booking_slot_locks(expires_at) WHERE released_at IS NULL;
```

#### 17. `payments`

**Purpose:** Payment records linked to bookings.

```sql
CREATE TABLE public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          uuid NOT NULL REFERENCES bookings(id),
  customer_id         uuid NOT NULL REFERENCES users(id),
  amount_fils         integer NOT NULL,
  currency            text NOT NULL DEFAULT 'AED',
  status              payment_status NOT NULL DEFAULT 'pending',
  payment_method      text, -- 'card', 'apple_pay', 'google_pay'
  provider_ref        text, -- external payment provider reference
  idempotency_key     text NOT NULL UNIQUE,
  failure_reason      text,
  paid_at             timestamptz,
  refunded_at         timestamptz,
  refund_amount_fils  integer DEFAULT 0,
  metadata            jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider_ref ON payments(provider_ref) WHERE provider_ref IS NOT NULL;
```

#### 18. `payouts`

**Purpose:** Provider payout records.

```sql
CREATE TABLE public.payouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         uuid NOT NULL REFERENCES providers(id),
  amount_fils         integer NOT NULL,
  currency            text NOT NULL DEFAULT 'AED',
  status              payout_status NOT NULL DEFAULT 'pending',
  period_start        timestamptz NOT NULL,
  period_end          timestamptz NOT NULL,
  booking_count       integer NOT NULL DEFAULT 0,
  payout_ref          text, -- external payout reference
  processed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payouts_provider ON payouts(provider_id, created_at DESC);
CREATE INDEX idx_payouts_status ON payouts(status);
```

#### 19. `provider_wallet_ledger`

**Purpose:** Double-entry ledger for provider earnings. Every booking completion, cancellation fee, or payout creates an entry.

```sql
CREATE TABLE public.provider_wallet_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid NOT NULL REFERENCES providers(id),
  booking_id      uuid REFERENCES bookings(id),
  payout_id       uuid REFERENCES payouts(id),
  entry_type      text NOT NULL, -- 'earning', 'cancellation_fee', 'bonus', 'payout', 'adjustment'
  amount_fils     integer NOT NULL, -- positive = credit, negative = debit
  balance_fils    integer NOT NULL, -- running balance after this entry
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pwl_provider ON provider_wallet_ledger(provider_id, created_at DESC);
```

#### 20. `reviews`

**Purpose:** Customer reviews of completed bookings.

```sql
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

CREATE INDEX idx_reviews_provider ON reviews(provider_id) WHERE is_published = true;
CREATE INDEX idx_reviews_service ON reviews(service_id) WHERE is_published = true;
```

#### 21. `support_tickets`

```sql
CREATE TABLE public.support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid REFERENCES bookings(id),
  created_by      uuid NOT NULL REFERENCES users(id),
  assigned_to     uuid REFERENCES users(id), -- admin/ops
  status          ticket_status NOT NULL DEFAULT 'open',
  priority        integer NOT NULL DEFAULT 3, -- 1=critical, 5=low
  subject         text NOT NULL,
  description     text NOT NULL,
  category        text, -- 'booking_issue', 'payment', 'provider_complaint', 'refund_request'
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_st_status ON support_tickets(status);
CREATE INDEX idx_st_booking ON support_tickets(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_st_assigned ON support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;
```

#### 22. `coupons`

```sql
CREATE TABLE public.coupons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  description     text,
  discount_type   text NOT NULL, -- 'percentage', 'fixed_amount'
  discount_value  integer NOT NULL, -- percentage (e.g. 15) or fils amount
  max_discount_fils integer, -- cap for percentage discounts
  min_order_fils  integer DEFAULT 0,
  usage_limit     integer, -- total uses allowed, NULL = unlimited
  usage_count     integer NOT NULL DEFAULT 0,
  per_user_limit  integer NOT NULL DEFAULT 1,
  valid_from      timestamptz NOT NULL,
  valid_until     timestamptz NOT NULL,
  applicable_services uuid[], -- NULL = all services
  applicable_categories uuid[], -- NULL = all categories
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupons_code ON coupons(code) WHERE is_active = true;
```

#### 23. `coupon_usages`

```sql
CREATE TABLE public.coupon_usages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   uuid NOT NULL REFERENCES coupons(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  booking_id  uuid NOT NULL REFERENCES bookings(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, booking_id)
);

CREATE INDEX idx_cu_user ON coupon_usages(coupon_id, user_id);
```

#### 24. `admin_notes`

```sql
CREATE TABLE public.admin_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'booking', 'provider', 'user', 'ticket'
  entity_id   uuid NOT NULL,
  author_id   uuid NOT NULL REFERENCES users(id),
  note        text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_an_entity ON admin_notes(entity_type, entity_id);
```

#### 25. `notifications`

```sql
CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  channel     notification_channel NOT NULL DEFAULT 'in_app',
  title       text NOT NULL,
  body        text NOT NULL,
  data        jsonb DEFAULT '{}'::jsonb, -- deep link info, booking_id, etc.
  is_read     boolean NOT NULL DEFAULT false,
  sent_at     timestamptz, -- NULL until dispatched
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_notif_pending ON notifications(channel, created_at) WHERE sent_at IS NULL;
```

#### 26. `audit_logs`

```sql
CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES users(id), -- NULL for system
  action      text NOT NULL, -- 'booking.created', 'provider.suspended', etc.
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_al_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_al_actor ON audit_logs(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_al_action ON audit_logs(action, created_at DESC);
```

### Updated_at Trigger

Applied to all tables with `updated_at`:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied per table:
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ... repeat for all tables with updated_at
```

---

## SECTION 3: AUTHORIZATION + RLS

### Role Claim Strategy

User role is stored in two places:
1. `auth.users.raw_app_meta_data->>'role'` — set on signup, used in RLS policies via `auth.jwt()->'app_metadata'->>'role'`
2. `public.users.role` — for joins and admin queries

On signup, a DB trigger copies the role to `app_metadata`:

```sql
-- Helper to get current user role from JWT
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT coalesce(
    auth.jwt()->'app_metadata'->>'role',
    'customer'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper to check if current user is admin or ops
CREATE OR REPLACE FUNCTION public.is_admin_or_ops()
RETURNS boolean AS $$
  SELECT current_user_role() IN ('admin', 'ops_manager');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper to get current provider_id
CREATE OR REPLACE FUNCTION public.current_provider_id()
RETURNS uuid AS $$
  SELECT id FROM providers WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### RLS Policies

#### `users` table

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own record
CREATE POLICY users_read_own ON users FOR SELECT
  USING (id = auth.uid());

-- Admins can read all
CREATE POLICY users_read_admin ON users FOR SELECT
  USING (is_admin_or_ops());

-- Users can update their own non-role fields (role changes via edge function only)
CREATE POLICY users_update_own ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM users WHERE id = auth.uid()));
```

#### `user_profiles` table

```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY up_read_own ON user_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY up_read_admin ON user_profiles FOR SELECT
  USING (is_admin_or_ops());

CREATE POLICY up_update_own ON user_profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY up_insert_own ON user_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

#### `providers` table

```sql
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Providers read their own record
CREATE POLICY providers_read_own ON providers FOR SELECT
  USING (user_id = auth.uid());

-- Customers can read active providers (for discovery)
CREATE POLICY providers_read_active ON providers FOR SELECT
  USING (status = 'active' AND current_user_role() = 'customer');

-- Admins read all
CREATE POLICY providers_read_admin ON providers FOR SELECT
  USING (is_admin_or_ops());

-- Only admin can update provider status (via edge function with service_role)
-- Providers can update limited fields
CREATE POLICY providers_update_own ON providers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

#### `bookings` table

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Customers see their own bookings
CREATE POLICY bookings_read_customer ON bookings FOR SELECT
  USING (customer_id = auth.uid());

-- Providers see bookings assigned to them
CREATE POLICY bookings_read_provider ON bookings FOR SELECT
  USING (provider_id = current_provider_id());

-- Admins see all
CREATE POLICY bookings_read_admin ON bookings FOR SELECT
  USING (is_admin_or_ops());

-- Bookings are ONLY created via edge functions (service_role bypasses RLS)
-- No direct INSERT policy for customers
```

#### `payments` table

```sql
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_read_own ON payments FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY payments_read_admin ON payments FOR SELECT
  USING (is_admin_or_ops());

-- All payment mutations via edge functions only
```

#### `reviews` table

```sql
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Published reviews are public
CREATE POLICY reviews_read_published ON reviews FOR SELECT
  USING (is_published = true);

-- Customer can see their own unpublished reviews
CREATE POLICY reviews_read_own ON reviews FOR SELECT
  USING (customer_id = auth.uid());

-- Admin sees all
CREATE POLICY reviews_read_admin ON reviews FOR SELECT
  USING (is_admin_or_ops());

-- Customer can insert review only for their completed booking
CREATE POLICY reviews_insert ON reviews FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_id
      AND bookings.customer_id = auth.uid()
      AND bookings.status = 'completed'
    )
  );
```

#### `notifications` table

```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_read_own ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY notif_update_own ON notifications FOR UPDATE
  USING (user_id = auth.uid()); -- mark as read
```

#### `services` / `service_categories` / `service_variants`

```sql
-- Public read for active records, admin full access
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY sc_read ON service_categories FOR SELECT USING (is_active = true);
CREATE POLICY sc_admin ON service_categories FOR ALL USING (is_admin_or_ops());

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY s_read ON services FOR SELECT USING (is_active = true);
CREATE POLICY s_admin ON services FOR ALL USING (is_admin_or_ops());

ALTER TABLE service_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY sv_read ON service_variants FOR SELECT USING (is_active = true);
CREATE POLICY sv_admin ON service_variants FOR ALL USING (is_admin_or_ops());
```

### Actions That MUST Bypass RLS (service_role in Edge Functions)

| Action | Reason |
|--------|--------|
| Create booking | Complex transaction with slot lock, payment, assignment |
| Confirm payment | Webhook from external provider, no user JWT |
| Assign/reassign provider | System logic, not user-initiated |
| Update booking status | State machine validation required |
| Process refund | Financial operation requiring audit |
| Update provider status | Admin action with audit trail |
| Run payouts | Batch financial operation |
| Send notifications | System-initiated |
| Cleanup expired locks | Cron job |

---

## SECTION 4: REAL BOOKING ENGINE

### Booking State Machine

```
                                    ┌─────────────────────────────────────────┐
                                    │                                         │
draft ──→ slot_locked ──→ payment_pending ──→ confirmed ──→ provider_assigned │
  │            │               │                  │              │            │
  │            │               │                  │              ▼            │
  │            │               │                  │       provider_accepted   │
  │            │               │                  │              │            │
  │            │               │                  │              ▼            │
  │            │               │                  │         in_progress       │
  │            │               │                  │              │            │
  │            │               │                  │              ▼            │
  │            │               │                  │          completed        │
  │            │               │                  │                           │
  ▼            ▼               ▼                  ▼                           │
cancelled  expired(→draft)  payment_failed     cancelled_by_customer         │
                                               cancelled_by_provider ────────┘
                                               cancelled_by_admin
                                               no_show
                                               disputed ──→ refunded
```

### Valid State Transitions

```sql
-- Enforced in the update-booking-status edge function
valid_transitions = {
  'draft':                ['slot_locked', 'cancelled_by_customer'],
  'slot_locked':          ['payment_pending', 'draft'], -- draft = lock expired
  'payment_pending':      ['confirmed', 'payment_failed'],
  'payment_failed':       ['slot_locked', 'cancelled_by_customer'], -- retry or abandon
  'confirmed':            ['provider_assigned', 'cancelled_by_customer', 'cancelled_by_admin'],
  'provider_assigned':    ['provider_accepted', 'confirmed', 'cancelled_by_provider', 'cancelled_by_customer', 'cancelled_by_admin'],
  'provider_accepted':    ['in_progress', 'cancelled_by_provider', 'cancelled_by_customer', 'cancelled_by_admin'],
  'in_progress':          ['completed', 'no_show', 'disputed'],
  'completed':            ['disputed'],
  'no_show':              ['disputed', 'refunded'],
  'disputed':             ['refunded', 'completed'], -- resolved in either direction
  'cancelled_by_customer':['refunded'],
  'cancelled_by_provider':['confirmed', 'refunded'], -- confirmed = reassigned to new provider
  'cancelled_by_admin':   ['refunded'],
}
```

### Slot Generation Rules

Slots are **not stored as rows**. They are computed on-the-fly:

```
Input:
  - service.base_duration_minutes (or variant.duration_minutes)
  - service.buffer_minutes
  - provider.availability_rules (weekly recurring)
  - provider.blocked_slots (explicit blocks)
  - provider's existing confirmed bookings
  - booking_slot_locks (active, unexpired)
  - requested date range

Algorithm:
  1. Get provider's availability rule for the requested day_of_week
  2. Generate potential slots at 30-minute intervals within the availability window
  3. Each slot = [start, start + duration + buffer]
  4. Remove slots that overlap with:
     a. Existing confirmed/in_progress bookings (including their buffer)
     b. Active slot locks (unexpired, unreleased)
     c. Blocked slots
  5. Return available slots
```

### Slot Lock Mechanism

```
POST /functions/v1/lock-slot
{
  service_id, variant_id?, provider_id?, start_time, address_id?
}

Logic:
  1. Validate service exists and is active
  2. If provider_id given: validate provider is active + offers this service
  3. If no provider_id: find best-available provider (see auto-assignment)
  4. BEGIN TRANSACTION
  5. SELECT ... FOR UPDATE on provider's existing locks + bookings for overlap check
  6. If overlap: ROLLBACK, return 409 Conflict
  7. Create booking row (status = 'draft')
  8. Create slot_lock row (expires_at = now() + 10 minutes)
  9. Update booking status to 'slot_locked'
  10. COMMIT
  11. Return booking_id, lock_expires_at
```

### Auto-Assignment Algorithm (Best Available)

```
Input: service_id, variant_id, city, start_time, end_time

1. Find all providers where:
   - status = 'active'
   - has provider_services entry for this service (is_approved = true, is_active = true)
   - has service_area matching customer's city
   - has availability_rule for this day_of_week covering the time range
   - does NOT have a blocked_slot overlapping
   - does NOT have a confirmed booking overlapping (including buffer)
   - does NOT have an active slot_lock overlapping

2. Rank by:
   - reliability_score DESC (40% weight)
   - rating_avg DESC (30% weight)
   - total_bookings ASC (20% weight — give newer providers chances)
   - random tiebreaker (10% weight)

3. Return top provider
```

### Double-Booking Prevention

Three layers:
1. **Application-level**: Slot lock check before booking creation
2. **Database-level**: `SELECT ... FOR UPDATE` on overlapping time ranges within transaction
3. **Constraint-level**: A trigger that rejects INSERT/UPDATE on bookings if time overlap exists for same provider:

```sql
CREATE OR REPLACE FUNCTION check_no_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE provider_id = NEW.provider_id
    AND id != NEW.id
    AND status NOT IN ('cancelled_by_customer', 'cancelled_by_provider', 'cancelled_by_admin', 'refunded', 'payment_failed', 'draft')
    AND tstzrange(start_time, end_time + (buffer_minutes || ' minutes')::interval) &&
        tstzrange(NEW.start_time, NEW.end_time + (NEW.buffer_minutes || ' minutes')::interval)
  ) THEN
    RAISE EXCEPTION 'Overlapping booking exists for this provider';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_double_booking
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.provider_id IS NOT NULL AND NEW.status NOT IN ('cancelled_by_customer', 'cancelled_by_provider', 'cancelled_by_admin', 'refunded', 'payment_failed', 'draft'))
  EXECUTE FUNCTION check_no_overlap();
```

### Slot Lock Expiry

```sql
-- pg_cron job running every 60 seconds
SELECT cron.schedule('expire-slot-locks', '* * * * *', $$
  UPDATE booking_slot_locks
  SET released_at = now()
  WHERE expires_at < now() AND released_at IS NULL;

  UPDATE bookings
  SET status = 'draft', updated_at = now()
  WHERE status = 'slot_locked'
  AND id IN (
    SELECT booking_id FROM booking_slot_locks
    WHERE released_at IS NOT NULL
    AND expires_at < now()
  );
$$);
```

### Booking Creation — Complete Flow

```
Step 1: Customer selects service + variant + time + provider (or best-available)
Step 2: Frontend calls lock-slot → gets booking_id + lock_expires_at
Step 3: Frontend shows checkout with countdown timer (10 min)
Step 4: Customer confirms → frontend calls create-payment-intent
Step 5: Edge function creates payment row (status=pending), updates booking to payment_pending
Step 6: Customer completes payment on provider's checkout
Step 7: Payment webhook hits confirm-payment edge function
Step 8: Edge function:
  a. Validate idempotency_key
  b. Update payment to succeeded
  c. Update booking to confirmed
  d. Release slot_lock (mark released_at)
  e. If instant_book: assign provider, set provider_assigned
  f. If not instant_book: notify provider for acceptance
  g. Create notification for customer
  h. Create booking_status_history entries
```

### Payment Failure Recovery

```
If payment webhook returns failed:
1. Update payment status to 'failed'
2. Update booking status to 'payment_failed'
3. Release slot lock
4. Notify customer
5. Customer can retry (goes back to slot_locked → payment_pending)
```

### Cancellation Windows

```
Policy:
  - > 24h before start: Full refund
  - 12-24h before start: 50% refund
  - 6-12h before start: 25% refund
  - < 6h before start: No refund
  - After provider assigned but before acceptance: Full refund
  - Provider cancels: Always full refund + provider penalty

Implementation:
  cancel-booking edge function calculates refund_amount based on
  (booking.start_time - now()) and the cancellation policy.
```

### Reschedule Logic

```
1. Customer requests reschedule with new time
2. Edge function:
   a. Check reschedule window (must be > 6h before original start)
   b. Lock new slot for same provider
   c. If lock succeeds: cancel old booking (internal cancel, no refund), create new linked booking
   d. If lock fails: return unavailable
   e. No additional payment if same price; charge difference if variant changes
```

### No-Show Logic

```
1. Provider marks customer as no-show (available after start_time + 15 min)
2. Admin can also mark no-show
3. No-show = service_price charged, no refund by default
4. Customer can dispute → support ticket created → admin resolves
```

### Provider Acceptance Flow (non-instant-book)

```
1. Booking confirmed → notification sent to provider
2. Provider has 30 minutes to accept/decline
3. If accepted: booking → provider_accepted
4. If declined: booking → cancelled_by_provider → trigger reassignment
5. If no response in 30 min: auto-decline → trigger reassignment
6. Reassignment: run auto-assignment for next best provider, up to 3 attempts
7. If all attempts fail: booking → cancelled_by_admin → full refund
```

### Idempotency

Every booking creation and payment requires an `idempotency_key` (UUID generated client-side). The key is stored as UNIQUE on both `bookings` and `payments`. Duplicate requests return the existing record instead of creating a new one.

---

## SECTION 5: PROVIDER OPS LAYER

### Provider Onboarding Flow

```
1. User signs up with role = 'provider'
2. Provider record created: status = 'pending_onboarding'
3. Provider completes profile (name, bio, photo, city, languages)
4. Provider uploads documents:
   - National ID / Emirates ID
   - Professional license/certification
   - Background check consent
5. Provider selects services they offer
6. Provider sets availability rules
7. Provider submits for review → status = 'documents_submitted'
8. Admin/ops reviews:
   - Verify documents → verification status per doc
   - Approve services → provider_services.is_approved
   - If all good: provider status → 'approved' → 'active'
   - If issues: status stays, rejection reason noted
```

### Provider Status Transitions

```
pending_onboarding → documents_submitted → under_review → approved → active
                                                                    ↓
                                                                  paused (self)
                                                                    ↓
                                                                  active
                                                                    ↓
                                                                  suspended (admin)
                                                                    ↓
                                                                  active (admin reactivation)
                                                                    ↓
                                                                  deactivated (permanent)
```

### Availability Management

| Frontend Action | Backend Effect |
|----------------|----------------|
| Set weekly schedule | UPSERT `provider_availability_rules` |
| Block specific dates | INSERT `provider_blocked_slots` |
| Pause mode (toggle) | UPDATE `providers.status` = 'paused', block all future slots |
| Resume | UPDATE `providers.status` = 'active' |

### Temporary Unavailability (Pause Mode)

When provider pauses:
1. Set `providers.status = 'paused'`
2. All future unconfirmed bookings: trigger reassignment
3. Already-accepted bookings: provider must honor or manually cancel (penalty applies)
4. Provider hidden from discovery

### Provider Performance Scoring

```sql
reliability_score = (
  (completed_bookings / total_assigned_bookings) * 60  -- completion rate: 60%
  + (1 - cancellation_rate) * 25                       -- low cancellations: 25%
  + (on_time_rate) * 15                                 -- punctuality: 15%
) * 100

-- Recalculated nightly via cron
-- Score range: 0-100
-- Below 60: warning
-- Below 40: auto-suspension review
```

### Suspension Rules

| Trigger | Action |
|---------|--------|
| reliability_score < 40 for 7 consecutive days | Auto-flag for review |
| 3+ customer complaints in 7 days | Auto-flag for review |
| Cancellation rate > 30% in rolling 30 days | Warning notification |
| Cancellation rate > 50% in rolling 30 days | Auto-suspend |
| No-show by provider (confirmed but didn't arrive) | Immediate suspend + review |
| Failed background check | Immediate deactivate |

### Reactivation

1. Admin reviews suspension reason
2. If corrective action taken: admin sets status → 'active'
3. Audit log entry created
4. Provider notified

---

## SECTION 6: ADMIN + OPS PANEL LOGIC

### Admin Capabilities Matrix

| Action | Admin | Ops Manager |
|--------|-------|-------------|
| View all users | Yes | City-scoped |
| Approve providers | Yes | Yes |
| Suspend providers | Yes | Yes (city-scoped) |
| Deactivate providers | Yes | No |
| Create/edit services | Yes | No |
| Set pricing | Yes | No |
| View all bookings | Yes | City-scoped |
| Manual reassignment | Yes | Yes |
| Cancel bookings | Yes | Yes |
| Approve refunds | Yes | No |
| Process payouts | Yes | No |
| Manage coupons | Yes | No |
| View audit logs | Yes | Own actions |
| Manage other admins | Yes | No |

### Dashboard-Triggered vs Automated

| Action | Trigger |
|--------|---------|
| Provider approval | Dashboard (manual review) |
| Provider suspension (quality) | Automated flag → Dashboard confirmation |
| Provider suspension (emergency) | Dashboard (immediate) |
| Booking reassignment (provider decline) | Automated |
| Booking reassignment (manual) | Dashboard |
| Refund (cancellation policy) | Automated |
| Refund (dispute resolution) | Dashboard |
| Payout processing | Automated (weekly cron) + Dashboard approval |
| Coupon creation | Dashboard |
| Service pricing changes | Dashboard |
| Notification sending | Automated |
| Slot lock cleanup | Automated (cron) |
| Reliability score update | Automated (nightly cron) |

### Dispute Resolution Flow

```
1. Customer or provider flags booking as disputed
2. Support ticket auto-created, priority = 2
3. Admin reviews:
   - Booking details, status history
   - Payment records
   - Provider/customer notes
   - Any uploaded evidence
4. Admin decides:
   - Resolve in customer favor → refund (full or partial)
   - Resolve in provider favor → no refund, customer notified
   - Resolve as no-fault → partial refund, no provider penalty
5. Resolution recorded in audit_logs and admin_notes
6. Both parties notified
```

---

## SECTION 7: PAYMENTS, PAYOUTS, AND MONEY LOGIC

### Payment Flow

```
create-payment-intent (Edge Function)
  Input: booking_id
  1. Validate booking exists, status = slot_locked, owned by caller
  2. Calculate total: service_price - discount + tax
  3. Create payment row (status = pending, idempotency_key)
  4. Call payment provider API to create intent/session
  5. Update booking to payment_pending
  6. Return client_secret / redirect URL

confirm-payment (Edge Function — webhook handler)
  Input: webhook payload from payment provider
  1. Verify webhook signature
  2. Find payment by provider_ref
  3. If already succeeded: return 200 (idempotent)
  4. BEGIN TRANSACTION
  5. Update payment status = succeeded, paid_at = now()
  6. Update booking status = confirmed
  7. Calculate platform_fee and provider_payout:
     - platform_fee = total * commission_rate_bps / 10000
     - provider_payout = total - platform_fee
  8. Store on booking: platform_fee_fils, provider_payout_fils
  9. Release slot lock
  10. COMMIT
  11. Trigger provider assignment (async)
  12. Send confirmation notification
```

### Refund Logic

```
Refund amount calculation:
  hours_until_start = (booking.start_time - now()) in hours

  if hours_until_start > 24: refund_percent = 100
  if hours_until_start > 12: refund_percent = 50
  if hours_until_start > 6:  refund_percent = 25
  else: refund_percent = 0

  -- Provider-initiated cancel: always 100%
  -- Admin override: any amount

  refund_amount = (booking.total_fils * refund_percent) / 100

  -- Process via payment provider refund API
  -- Update payment: refund_amount_fils, status = refunded/partially_refunded
  -- Update booking: status = refunded
  -- Ledger entry on provider_wallet if provider was assigned
```

### Provider Payout Ledger

```
On booking completion:
  INSERT provider_wallet_ledger:
    entry_type = 'earning'
    amount_fils = booking.provider_payout_fils
    balance_fils = previous_balance + amount

On provider cancellation penalty:
  INSERT provider_wallet_ledger:
    entry_type = 'cancellation_fee'
    amount_fils = -penalty_amount
    balance_fils = previous_balance - penalty

On payout:
  INSERT provider_wallet_ledger:
    entry_type = 'payout'
    amount_fils = -payout_amount
    balance_fils = previous_balance - payout_amount
```

### Payout Rules

- **Eligibility**: Booking must be completed for 72+ hours (hold period)
- **Frequency**: Weekly (every Sunday)
- **Minimum**: 50 AED (5000 fils)
- **Process**:
  1. Cron calculates eligible earnings per provider
  2. Creates payout record (status = pending)
  3. Admin reviews and approves batch (status = eligible)
  4. System processes transfer (status = processing → completed)
  5. Ledger entry created on completion

### Tax/Fees Model

```sql
-- On booking creation:
service_price_fils  = base price or variant price or provider custom price
discount_fils       = coupon discount (capped at max_discount)
tax_fils            = (service_price - discount) * tax_rate  -- VAT 5% in UAE = 500 bps
total_fils          = service_price - discount + tax
platform_fee_fils   = total * commission_rate_bps / 10000
provider_payout_fils = total - platform_fee
```

---

## SECTION 8: REVIEWS, TRUST, AND SAFETY

### Review Eligibility

- Only the **customer** of a **completed** booking can leave a review
- Review window: 14 days after completion
- One review per booking (enforced by UNIQUE constraint on booking_id)

### Anti-Fraud Basics

- Rate limit: max 3 reviews per customer per day
- Minimum booking value for review eligibility (prevent fake micro-bookings)
- Text analysis flag for profanity/harassment (basic keyword check)
- Reviews from accounts < 7 days old are auto-flagged for moderation

### Provider Badges

| Badge | Criteria |
|-------|----------|
| **Verified** | All KYC documents approved |
| **Top Rated** | rating_avg >= 4.5 AND rating_count >= 20 |
| **Reliable** | reliability_score >= 90 for 90+ days |
| **New** | Active for < 30 days |
| **Premium** | Manually assigned by admin |

### Review Moderation

```
1. Review submitted → is_published = true by default
2. Auto-flag if:
   - Contains blocked keywords
   - Rating = 1 with no comment (suspicious)
   - Reviewer account age < 7 days
3. Flagged reviews: is_flagged = true, appear in admin queue
4. Admin can:
   - Approve (unflag)
   - Hide (is_published = false)
   - Delete (soft delete)
5. Provider can report abusive review → creates support ticket
```

### Trust Score

```
trust_score = f(
  verification_complete: +20,
  rating_avg * 10: up to +50,
  reliability_score / 5: up to +20,
  account_age_months (capped at 12) / 1.2: up to +10
)
-- Max 100, displayed as badge tiers
```

---

## SECTION 9: NOTIFICATIONS + REALTIME EVENTS

### Event Matrix

| Event | In-App | Email | SMS | WhatsApp | Push |
|-------|--------|-------|-----|----------|------|
| Booking created | Yes | Yes | - | - | Yes |
| Booking confirmed (payment success) | Yes | Yes | Yes | Yes | Yes |
| Provider assigned | Yes | Yes | - | - | Yes |
| Provider accepted | Yes | - | - | - | Yes |
| Provider declined (reassigning) | Yes | - | - | - | - |
| Slot lock expiring (2 min warning) | Yes | - | - | - | Yes |
| Payment failed | Yes | Yes | - | - | Yes |
| Booking cancelled | Yes | Yes | Yes | Yes | Yes |
| Booking rescheduled | Yes | Yes | - | Yes | Yes |
| Service starting (30 min before) | Yes | - | Yes | Yes | Yes |
| Service completed | Yes | Yes | - | - | Yes |
| Review requested (2h after completion) | Yes | Yes | - | - | Yes |
| Refund processed | Yes | Yes | - | - | - |
| Provider: new booking request | Yes | - | Yes | Yes | Yes |
| Provider: payout processed | Yes | Yes | - | - | - |
| Provider: suspension warning | Yes | Yes | - | - | - |

### Supabase Realtime Usage

Used for **in-app** real-time updates only:
- Booking status changes (customer subscribes to their booking)
- Provider dashboard (new booking requests, status updates)
- Notification bell count

```typescript
// Client subscription example
supabase
  .channel('booking-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'bookings',
    filter: `customer_id=eq.${userId}`
  }, (payload) => {
    // Update UI
  })
  .subscribe()
```

### Notification Dispatch Architecture

```
1. Edge function / trigger inserts row into notifications table
2. For in_app: Supabase Realtime delivers automatically via subscription
3. For external channels (email, sms, whatsapp, push):
   - pg_cron every 30 seconds queries: channel != 'in_app' AND sent_at IS NULL
   - Calls send-notifications edge function
   - Edge function dispatches to appropriate provider (Resend, Twilio, FCM)
   - Updates sent_at on success
   - On failure: logs error, retries up to 3 times with backoff
```

---

## SECTION 10: EDGE FUNCTIONS / SERVER FUNCTIONS

| Function | Purpose | Trigger | Auth | Transactional | Idempotent |
|----------|---------|---------|------|---------------|------------|
| `create-booking` | Create draft booking | App | Customer JWT | Yes | Yes (idempotency_key) |
| `lock-slot` | Reserve time slot | App | Customer JWT | Yes | Yes |
| `create-payment-intent` | Initialize payment | App | Customer JWT | Yes | Yes |
| `confirm-payment` | Handle payment webhook | Webhook | Webhook signature | Yes | Yes (provider_ref) |
| `handle-payment-failure` | Handle failed payment | Webhook | Webhook signature | Yes | Yes |
| `assign-provider` | Auto-assign or manual assign | System/Admin | service_role | Yes | No (retryable) |
| `provider-accept-booking` | Provider accepts | App | Provider JWT | Yes | Yes |
| `provider-decline-booking` | Provider declines, trigger reassign | App | Provider JWT | Yes | Yes |
| `cancel-booking` | Cancel with refund calc | App | Customer/Provider/Admin JWT | Yes | Yes |
| `reschedule-booking` | Change booking time | App | Customer JWT | Yes | Yes |
| `complete-booking` | Mark service complete | App | Provider JWT | Yes | Yes |
| `process-refund` | Execute refund | System/Admin | service_role | Yes | Yes |
| `run-provider-payouts` | Weekly payout batch | Cron | service_role | Yes | Yes (period key) |
| `send-notifications` | Dispatch pending external notifications | Cron (30s) | service_role | No | No (safe to retry) |
| `expire-slot-locks` | Clean up expired locks | Cron (60s) | service_role | Yes | Yes |
| `recalc-provider-scores` | Nightly reliability recalc | Cron (daily 3am) | service_role | No | Yes |
| `provider-auto-decline` | Auto-decline unresponded requests | Cron (5min) | service_role | Yes | Yes |
| `submit-review` | Validate and create review | App | Customer JWT | Yes | Yes |

### Function Detail: `create-booking`

```typescript
// Input
{
  service_id: string
  variant_id?: string
  provider_id?: string  // null = best-available
  start_time: string    // ISO 8601
  address_id?: string   // required if service.requires_address
  coupon_code?: string
  notes?: string
  idempotency_key: string
}

// Output
{
  booking_id: string
  booking_number: string
  lock_expires_at: string
  total_fils: number
  breakdown: {
    service_price_fils: number
    discount_fils: number
    tax_fils: number
    total_fils: number
  }
}

// Auth: Customer JWT required
// Transaction: Full SERIALIZABLE transaction
// Idempotent: Returns existing booking if idempotency_key matches
```

---

## SECTION 11: API CONTRACT

### Auth & Session

```typescript
// Bootstrap — handled by Supabase client SDK
supabase.auth.signUp({ phone, password })
supabase.auth.signInWithOtp({ phone })
supabase.auth.getSession() // returns JWT with role in app_metadata
```

### Service Catalog (Direct PostgREST — RLS enforced)

```typescript
// GET categories
const { data } = await supabase
  .from('service_categories')
  .select('id, name, name_ar, slug, icon_url, sort_order')
  .eq('is_active', true)
  .order('sort_order')

// GET services by category
const { data } = await supabase
  .from('services')
  .select(`
    id, name, name_ar, slug, description, short_description,
    image_url, base_price_fils, base_duration_minutes, is_online,
    service_variants(id, name, duration_minutes, price_fils)
  `)
  .eq('category_id', categoryId)
  .eq('is_active', true)
  .order('sort_order')
```

### Provider Discovery (Direct PostgREST)

```typescript
// GET providers for a service in a city
const { data } = await supabase
  .from('provider_services')
  .select(`
    provider_id,
    custom_price_fils,
    providers!inner(
      id, rating_avg, rating_count, is_instant_book,
      provider_profiles(display_name, avatar_url, bio, years_experience, certifications)
    )
  `)
  .eq('service_id', serviceId)
  .eq('is_approved', true)
  .eq('is_active', true)
  .eq('providers.status', 'active')
```

### Slot Fetching (Edge Function)

```typescript
// POST /functions/v1/get-available-slots
// Input
{
  service_id: string
  variant_id?: string
  provider_id?: string  // optional, null = show all providers' slots
  date: string          // YYYY-MM-DD
  city: string
}

// Output
{
  slots: Array<{
    start_time: string      // ISO 8601
    end_time: string
    provider_id: string
    provider_name: string
    is_instant_book: boolean
  }>
}
```

### Booking CRUD (Edge Functions)

```typescript
// POST /functions/v1/create-booking → see Section 10
// POST /functions/v1/cancel-booking
{ booking_id: string, reason?: string }
→ { refund_amount_fils: number, booking_status: string }

// POST /functions/v1/reschedule-booking
{ booking_id: string, new_start_time: string }
→ { new_booking_id: string, lock_expires_at: string }
```

### Booking List/Detail (PostgREST)

```typescript
// Customer's bookings
const { data } = await supabase
  .from('bookings')
  .select(`
    id, booking_number, status, start_time, end_time, total_fils,
    services(name, image_url),
    providers(provider_profiles(display_name, avatar_url))
  `)
  .eq('customer_id', userId)
  .order('start_time', { ascending: false })
```

### Provider Dashboard (PostgREST + Edge Functions)

```typescript
// Provider's upcoming bookings
const { data } = await supabase
  .from('bookings')
  .select(`
    id, booking_number, status, start_time, end_time, service_price_fils,
    services(name),
    user_profiles!bookings_customer_id_fkey(full_name, avatar_url),
    addresses(address_line1, city, district)
  `)
  .eq('provider_id', providerId)
  .in('status', ['provider_assigned', 'provider_accepted', 'in_progress'])
  .order('start_time')

// POST /functions/v1/provider-accept-booking
{ booking_id: string }

// POST /functions/v1/provider-decline-booking
{ booking_id: string, reason?: string }

// POST /functions/v1/complete-booking
{ booking_id: string }
```

### Provider Availability (PostgREST)

```typescript
// UPSERT availability rules
const { error } = await supabase
  .from('provider_availability_rules')
  .upsert({
    provider_id: providerId,
    day_of_week: 'monday',
    start_time: '09:00',
    end_time: '17:00',
    is_active: true
  })
```

### Admin (Edge Functions for mutations, PostgREST for reads)

```typescript
// POST /functions/v1/admin/approve-provider
{ provider_id: string }

// POST /functions/v1/admin/suspend-provider
{ provider_id: string, reason: string }

// POST /functions/v1/admin/approve-refund
{ booking_id: string, amount_fils: number }

// POST /functions/v1/admin/reassign-booking
{ booking_id: string, new_provider_id: string }
```

---

## SECTION 12: GITHUB WORKFLOW

### Branch Strategy

```
main          ← production (protected, requires PR + 1 approval)
  └── staging ← staging environment (auto-deploys to preview)
       └── feature/KH-{issue#}-{description}  ← feature branches
       └── fix/KH-{issue#}-{description}       ← bug fixes
       └── chore/KH-{issue#}-{description}     ← maintenance
```

### Branch Protection (main)

- Require PR with 1 approval
- Require status checks: lint, typecheck, test
- No force push
- No direct commits
- Require linear history (squash merge)

### Commit Convention

```
type(scope): description

Types: feat, fix, chore, docs, refactor, test, ci
Scopes: db, auth, booking, provider, admin, payment, notif, ui

Examples:
feat(db): add bookings table and RLS policies
fix(booking): prevent double-lock on concurrent requests
chore(ci): add migration safety check to PR workflow
```

### PR Template

```markdown
## What
<!-- One-line summary -->

## Why
<!-- Business or technical context -->

## How
<!-- Implementation approach -->

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing done
- [ ] RLS policies verified
- [ ] Migration is reversible

## Screenshots
<!-- If UI changes -->
```

### Issue Template

```markdown
## Description
<!-- What needs to be built/fixed -->

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
<!-- Implementation hints, edge cases -->

## Dependencies
<!-- Other issues that must be done first -->
```

### Issue Labels

```
type:feature, type:bug, type:chore, type:docs
scope:db, scope:auth, scope:booking, scope:provider, scope:admin, scope:payment, scope:notif
priority:critical, priority:high, priority:medium, priority:low
phase:1, phase:2, phase:3, phase:4, phase:5, phase:6, phase:7, phase:8
status:ready, status:in-progress, status:blocked, status:review
```

### Milestones

```
v0.1 — Schema + Auth Foundation
v0.2 — Service Catalog + Provider Model
v0.3 — Booking Engine Core
v0.4 — Provider Operations
v0.5 — Admin Panel Backend
v0.6 — Payments + Payouts
v0.7 — Notifications + Trust
v0.8 — Hardening + QA
v1.0 — Production Launch
```

---

## SECTION 13: FOLDER STRUCTURE

```
khidmat/
├── apps/
│   └── web/                          # Next.js app (App Router)
│       ├── app/
│       │   ├── (auth)/               # Auth pages (login, signup)
│       │   ├── (customer)/           # Customer-facing routes
│       │   │   ├── services/
│       │   │   ├── booking/
│       │   │   ├── profile/
│       │   │   └── bookings/
│       │   ├── (provider)/           # Provider dashboard routes
│       │   │   ├── dashboard/
│       │   │   ├── bookings/
│       │   │   ├── availability/
│       │   │   └── profile/
│       │   ├── (admin)/              # Admin panel routes
│       │   │   ├── dashboard/
│       │   │   ├── providers/
│       │   │   ├── bookings/
│       │   │   ├── services/
│       │   │   └── payouts/
│       │   ├── api/                  # Next.js API routes (if needed for SSR)
│       │   └── layout.tsx
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       │   ├── supabase/
│       │   │   ├── client.ts         # Browser client
│       │   │   ├── server.ts         # Server component client
│       │   │   └── middleware.ts     # Auth middleware
│       │   ├── utils/
│       │   └── constants/
│       ├── public/
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       └── package.json
│
├── supabase/
│   ├── config.toml                   # Supabase project config
│   ├── migrations/
│   │   ├── 00001_enums.sql
│   │   ├── 00002_users_profiles.sql
│   │   ├── 00003_providers.sql
│   │   ├── 00004_services.sql
│   │   ├── 00005_addresses.sql
│   │   ├── 00006_bookings.sql
│   │   ├── 00007_payments.sql
│   │   ├── 00008_reviews.sql
│   │   ├── 00009_support.sql
│   │   ├── 00010_notifications.sql
│   │   ├── 00011_audit.sql
│   │   ├── 00012_rls_policies.sql
│   │   ├── 00013_triggers.sql
│   │   ├── 00014_cron_jobs.sql
│   │   └── 00015_seed_categories.sql
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── supabase-client.ts
│   │   │   ├── auth.ts
│   │   │   ├── errors.ts
│   │   │   └── money.ts
│   │   ├── create-booking/
│   │   │   └── index.ts
│   │   ├── lock-slot/
│   │   │   └── index.ts
│   │   ├── get-available-slots/
│   │   │   └── index.ts
│   │   ├── create-payment-intent/
│   │   │   └── index.ts
│   │   ├── confirm-payment/
│   │   │   └── index.ts
│   │   ├── assign-provider/
│   │   │   └── index.ts
│   │   ├── provider-accept-booking/
│   │   │   └── index.ts
│   │   ├── provider-decline-booking/
│   │   │   └── index.ts
│   │   ├── cancel-booking/
│   │   │   └── index.ts
│   │   ├── reschedule-booking/
│   │   │   └── index.ts
│   │   ├── complete-booking/
│   │   │   └── index.ts
│   │   ├── process-refund/
│   │   │   └── index.ts
│   │   ├── submit-review/
│   │   │   └── index.ts
│   │   ├── send-notifications/
│   │   │   └── index.ts
│   │   ├── expire-slot-locks/
│   │   │   └── index.ts
│   │   ├── recalc-provider-scores/
│   │   │   └── index.ts
│   │   ├── run-provider-payouts/
│   │   │   └── index.ts
│   │   ├── provider-auto-decline/
│   │   │   └── index.ts
│   │   └── admin/
│   │       ├── approve-provider/
│   │       │   └── index.ts
│   │       ├── suspend-provider/
│   │       │   └── index.ts
│   │       ├── approve-refund/
│   │       │   └── index.ts
│   │       └── reassign-booking/
│   │           └── index.ts
│   └── seed/
│       ├── categories.sql
│       └── test-data.sql
│
├── packages/
│   └── types/
│       ├── database.ts               # Generated from Supabase (supabase gen types)
│       ├── enums.ts                  # Shared enum types
│       ├── api.ts                    # Request/response types
│       └── index.ts
│
├── docs/
│   ├── BACKEND_BLUEPRINT.md          # This document
│   ├── API_REFERENCE.md
│   └── DEPLOYMENT.md
│
├── scripts/
│   ├── generate-types.sh             # supabase gen types typescript
│   ├── seed-dev.sh                   # seed local dev database
│   └── reset-db.sh                   # reset and re-migrate local db
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Lint + typecheck + test
│   │   ├── migration-check.yml       # Check migration safety
│   │   └── deploy.yml                # Vercel deploy
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       ├── feature.md
│       ├── bug.md
│       └── task.md
│
├── .env.example
├── .gitignore
├── package.json                      # Root workspace
├── turbo.json                        # Turborepo config (optional)
└── README.md
```

### Why This Structure

- **Monorepo** with `apps/` and `packages/`: shared types between frontend and edge functions
- **Supabase directory** at root: follows Supabase CLI conventions for migrations and functions
- **Edge functions** each in their own directory: Supabase convention, enables independent deployment
- **Shared function utilities** in `_shared/`: DRY auth checks, error handling, money calculations
- **Scripts**: automate repetitive dev tasks
- **GitHub workflows**: enforce quality gates on every PR

---

## SECTION 14: ENVIRONMENT VARIABLES + SECURITY

### Browser-Safe (NEXT_PUBLIC_ prefix)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # anon key, safe for client
NEXT_PUBLIC_APP_URL=https://khidmatplus.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Server-Only (Vercel server / Edge Functions)

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # NEVER expose to client
SUPABASE_DB_URL=postgresql://...        # Direct DB connection
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+971...
FCM_SERVER_KEY=...
```

### Per-Environment

| Variable | Preview | Production |
|----------|---------|------------|
| SUPABASE_URL | staging project URL | prod project URL |
| SUPABASE_ANON_KEY | staging anon key | prod anon key |
| SUPABASE_SERVICE_ROLE_KEY | staging service role | prod service role |
| STRIPE keys | test mode keys | live mode keys |
| RESEND/TWILIO | sandbox/test | production |

### Security Rules

1. `SUPABASE_SERVICE_ROLE_KEY` used ONLY in Edge Functions and server-side code
2. Never import service_role key in any file under `apps/web/app/` client components
3. Stripe secret key only in Edge Functions
4. Webhook secrets only in webhook handler functions
5. `.env.local` in `.gitignore` — never committed
6. Vercel environment variables set via dashboard, scoped to preview/production

---

## SECTION 15: DEPLOYMENT PLAN

### Local Development

```bash
# 1. Clone repo
git clone https://github.com/your-org/khidmat.git
cd khidmat

# 2. Install dependencies
npm install

# 3. Start Supabase locally
npx supabase start
# This runs Postgres, Auth, Storage, Edge Functions locally

# 4. Apply migrations
npx supabase db reset  # applies all migrations + seed

# 5. Generate types
npm run generate-types

# 6. Start Next.js dev server
cd apps/web && npm run dev

# 7. Develop edge functions
npx supabase functions serve
```

### Staging / Preview

- Every PR auto-creates a Vercel preview deployment
- Preview deployments use **staging Supabase project**
- Staging Supabase project has same schema (migrations applied via CI)
- Staging uses test payment keys, sandbox notification providers

### Production Deployment

```
1. PR merged to main
2. GitHub Action runs:
   - Lint + typecheck + test
   - supabase db push (applies pending migrations to production)
3. Vercel auto-deploys main branch to production
4. Edge functions deployed via: supabase functions deploy --project-ref <prod-ref>
```

### Migration Safety

```yaml
# .github/workflows/migration-check.yml
- Run supabase db diff to verify migration generates expected changes
- Run supabase db lint to check for common SQL issues
- Require migration to be reversible (include both up and down)
- Block PR if migration drops columns/tables without explicit approval
```

### Rollback

- **Code**: Revert merge commit on main, Vercel auto-deploys previous version
- **Database**: Migrations should be backward-compatible. If breaking: apply a corrective migration forward (never roll back migrations in production)
- **Edge Functions**: Redeploy previous version from git history

### Seeding

```sql
-- supabase/seed/categories.sql
-- Run on fresh environments only
INSERT INTO service_categories (name, name_ar, slug, sort_order) VALUES
  ('Health', 'صحة', 'health', 1),
  ('Wellness', 'عافية', 'wellness', 2),
  ('Fitness', 'لياقة', 'fitness', 3);

INSERT INTO services (category_id, name, slug, base_price_fils, base_duration_minutes, buffer_minutes) VALUES
  ((SELECT id FROM service_categories WHERE slug='health'), 'Physiotherapy', 'physiotherapy', 25000, 60, 15),
  ((SELECT id FROM service_categories WHERE slug='wellness'), 'Deep Tissue Massage', 'deep-tissue-massage', 30000, 60, 15),
  ((SELECT id FROM service_categories WHERE slug='wellness'), 'Swedish Massage', 'swedish-massage', 25000, 60, 15),
  ((SELECT id FROM service_categories WHERE slug='fitness'), 'Yoga at Home', 'yoga-at-home', 20000, 60, 15),
  ((SELECT id FROM service_categories WHERE slug='fitness'), 'Personal Training', 'personal-training', 35000, 60, 15),
  ((SELECT id FROM service_categories WHERE slug='health'), 'Online Consultation', 'online-consultation', 15000, 30, 5);
```

---

## SECTION 16: BUILD ORDER

### Phase 1: Auth + Schema Foundation (Week 1)

**Outputs:** Database schema, auth flow, user/profile creation
**Files:** `supabase/migrations/00001-00005`, `packages/types/`, `apps/web/lib/supabase/`
**Dependencies:** None
**Tests:** Auth flow, profile creation, RLS on users/profiles

**Issues:**
- KH-001: Create enum types migration
- KH-002: Create users + user_profiles tables
- KH-003: Create providers + provider_profiles tables
- KH-004: Set up Supabase Auth with phone OTP
- KH-005: Create auth trigger (auto-create profile on signup)
- KH-006: Implement basic RLS for users, profiles
- KH-007: Set up Next.js project with Supabase client
- KH-008: Generate TypeScript types from schema

### Phase 2: Service Catalog + Provider Model (Week 2)

**Outputs:** Service browsing, provider onboarding backend
**Files:** migrations 00004-00007, edge functions for onboarding
**Dependencies:** Phase 1

**Issues:**
- KH-009: Create service_categories + services + service_variants tables
- KH-010: Create provider_services + provider_service_areas tables
- KH-011: Create provider_availability_rules + blocked_slots tables
- KH-012: Seed service categories and initial services
- KH-013: RLS for services (public read) and provider tables
- KH-014: Provider verification table and document upload storage
- KH-015: Edge function: provider onboarding submission

### Phase 3: Booking Engine Core (Week 3-4)

**Outputs:** Working booking flow end-to-end
**Files:** bookings migration, slot lock, booking edge functions
**Dependencies:** Phase 2

**Issues:**
- KH-016: Create bookings + booking_status_history tables
- KH-017: Create booking_slot_locks table
- KH-018: Create addresses table
- KH-019: Edge function: get-available-slots
- KH-020: Edge function: lock-slot (with overlap prevention)
- KH-021: Edge function: create-booking
- KH-022: Double-booking prevention trigger
- KH-023: Slot lock expiry cron job
- KH-024: Booking status transition validation
- KH-025: Edge function: cancel-booking with refund calculation
- KH-026: Edge function: reschedule-booking
- KH-027: Auto-assignment algorithm
- KH-028: RLS for bookings table

### Phase 4: Provider Operations (Week 5)

**Outputs:** Provider acceptance, decline, completion, scoring
**Dependencies:** Phase 3

**Issues:**
- KH-029: Edge function: provider-accept-booking
- KH-030: Edge function: provider-decline-booking + auto-reassign
- KH-031: Edge function: complete-booking
- KH-032: Provider auto-decline cron (30-min timeout)
- KH-033: Reliability score calculation logic
- KH-034: Nightly recalc-provider-scores cron
- KH-035: Provider pause/resume logic

### Phase 5: Admin Panel Backend (Week 6)

**Outputs:** Admin CRUD, manual overrides, audit trail
**Dependencies:** Phase 4

**Issues:**
- KH-036: Admin RLS policies (admin/ops roles)
- KH-037: Edge function: admin/approve-provider
- KH-038: Edge function: admin/suspend-provider
- KH-039: Edge function: admin/reassign-booking
- KH-040: Create support_tickets + admin_notes tables
- KH-041: Create audit_logs table + triggers
- KH-042: Admin service/pricing management

### Phase 6: Payments + Payouts (Week 7)

**Outputs:** Payment integration, payout ledger
**Dependencies:** Phase 3

**Issues:**
- KH-043: Create payments table
- KH-044: Create payouts + provider_wallet_ledger tables
- KH-045: Edge function: create-payment-intent (Stripe/Tap)
- KH-046: Edge function: confirm-payment (webhook handler)
- KH-047: Edge function: handle-payment-failure
- KH-048: Edge function: process-refund
- KH-049: Payout eligibility logic
- KH-050: Edge function: run-provider-payouts (weekly cron)
- KH-051: Create coupons + coupon_usages tables
- KH-052: Coupon validation in booking creation

### Phase 7: Notifications + Trust (Week 8)

**Outputs:** Full notification system, reviews, trust scores
**Dependencies:** Phase 6

**Issues:**
- KH-053: Create notifications table
- KH-054: Notification insert triggers on booking events
- KH-055: Edge function: send-notifications (external dispatch)
- KH-056: Supabase Realtime subscriptions for in-app
- KH-057: Create reviews table + RLS
- KH-058: Edge function: submit-review
- KH-059: Review moderation logic
- KH-060: Provider badge calculation

### Phase 8: Hardening + QA (Week 9-10)

**Outputs:** Production-ready system
**Dependencies:** All phases

**Issues:**
- KH-061: End-to-end booking flow test
- KH-062: Load test slot locking under concurrency
- KH-063: RLS audit — verify no data leakage
- KH-064: Payment failure recovery test
- KH-065: Timezone handling verification
- KH-066: Error handling standardization across edge functions
- KH-067: Rate limiting on public endpoints
- KH-068: Monitoring and alerting setup
- KH-069: Production environment setup
- KH-070: Launch checklist verification

---

## SECTION 17: TESTING STRATEGY

### Priority 1: Critical Path (Must Pass Before Launch)

| Test | Type | What It Verifies |
|------|------|-----------------|
| Slot lock prevents double-booking | Integration | Two concurrent lock requests for same slot — only one succeeds |
| Booking creation is idempotent | Integration | Same idempotency_key returns same booking, not duplicate |
| Payment confirmation is idempotent | Integration | Duplicate webhook doesn't double-credit |
| Expired slot locks release correctly | Integration | After 10 min, slot becomes available again |
| Cancellation refund calculation | Unit | Correct refund % based on time-to-start |
| Provider reassignment on decline | Integration | Decline triggers auto-assign to next provider |
| RLS: customer can't see other's bookings | Integration | Query with customer JWT returns only own bookings |
| RLS: provider can't see unassigned bookings | Integration | Provider JWT only returns their bookings |
| Booking state transitions are enforced | Unit | Invalid transitions throw error |
| Money calculations are consistent | Unit | Total = price - discount + tax, payout + fee = total |

### Priority 2: Important (Must Pass Before Beta)

| Test | Type |
|------|------|
| Provider availability slot generation | Unit |
| Buffer time included in overlap checks | Integration |
| Coupon validation (expired, usage limit, per-user limit) | Unit |
| Review can only be left for completed booking | Integration |
| Review can only be left by booking's customer | Integration |
| Admin can approve/suspend provider | Integration |
| Payout calculation matches ledger | Integration |
| Notification created on booking events | Integration |

### Priority 3: Robustness (Pre-Production)

| Test | Type |
|------|------|
| 50 concurrent slot lock requests | Load |
| Payment webhook with malformed signature rejected | Security |
| Timezone conversion for Dubai/Riyadh | Unit |
| Provider pause hides from discovery | Integration |
| Audit log created for all admin actions | Integration |
| Expired coupon rejected | Unit |

### Testing Tools

- **Unit tests**: Vitest (TypeScript, fast, works with Edge Function code)
- **Integration tests**: Vitest + Supabase local instance (test against real Postgres)
- **E2E**: Playwright (critical user flows through UI)
- **Load**: k6 (slot locking concurrency)

---

## SECTION 18: RISKS + FAILURE POINTS

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Double booking** | Critical | 3-layer prevention: app lock + DB SELECT FOR UPDATE + trigger constraint |
| **Silent payment mismatch** | Critical | Idempotency keys on all payment operations. 5-min cron reconciles pending payments. Alert on mismatch > 15 min |
| **Broken availability** | High | Slots computed on-the-fly (not cached stale). Lock mechanism prevents stale reads |
| **Provider unreliability** | High | Reliability scoring + auto-suspension + reassignment chain (3 attempts) |
| **Timezone bugs** | High | All DB timestamps in UTC. Only convert at display layer. Store timezone string on booking for reference |
| **Bad RLS rules** | Critical | Integration tests per role. Quarterly RLS audit. No sensitive data in public-readable tables |
| **Payout disputes** | Medium | Double-entry ledger with full audit trail. Every transaction traceable to booking |
| **Poor reassignment** | Medium | 3-attempt limit with increasing search radius. Fallback: cancel + full refund + alert ops |
| **Support overload** | Medium | Self-service cancellation/reschedule in app. Auto-refund for policy-eligible cancellations |
| **Weak auditability** | Medium | audit_logs table with before/after snapshots. booking_status_history for full lifecycle |
| **Slot lock thundering herd** | Medium | 10-min TTL limits holding. Cron cleanup every 60s. Rate limit on lock-slot endpoint |
| **Service_role key exposure** | Critical | Never imported in client code. Vercel env scoping. Code review checklist item |
| **Stale type definitions** | Low | CI step regenerates types and fails if diff detected |

---

## EXECUTION PLAN

### SQL Migration Order

```
1. 00001_enums.sql                  — all enum types
2. 00002_users_profiles.sql         — users, user_profiles
3. 00003_providers.sql              — providers, provider_profiles, verifications, areas, availability, blocked_slots
4. 00004_services.sql               — categories, services, variants, provider_services
5. 00005_addresses.sql              — addresses
6. 00006_bookings.sql               — bookings, status_history, slot_locks
7. 00007_payments.sql               — payments, payouts, wallet_ledger
8. 00008_reviews.sql                — reviews
9. 00009_support.sql                — support_tickets, admin_notes, coupons, coupon_usages
10. 00010_notifications.sql         — notifications
11. 00011_audit.sql                 — audit_logs
12. 00012_functions.sql             — helper functions (current_user_role, etc)
13. 00013_rls_policies.sql          — all RLS policies
14. 00014_triggers.sql              — updated_at, check_no_overlap, audit triggers
15. 00015_cron_jobs.sql             — pg_cron schedules
16. 00016_seed_categories.sql       — initial service data
```

### RLS Rollout Order

```
1. users + user_profiles (foundation — blocks all data by default)
2. service_categories + services + service_variants (public read)
3. providers + provider_profiles (own-read + customer discovery)
4. bookings (customer own, provider own, admin all)
5. payments (customer own, admin all)
6. notifications (own only)
7. reviews (public published, own unpublished)
8. All remaining tables
```

### Edge Functions Priority Order

```
1. get-available-slots          — needed for frontend slot picker
2. lock-slot                    — needed for booking flow
3. create-booking               — core booking creation
4. create-payment-intent        — payment flow
5. confirm-payment              — webhook handler
6. cancel-booking               — customer-facing
7. provider-accept-booking      — provider flow
8. provider-decline-booking     — provider flow
9. complete-booking             — service completion
10. assign-provider             — auto-assignment
11. expire-slot-locks           — cron
12. send-notifications          — cron
13. submit-review               — post-service
14. process-refund              — financial
15. run-provider-payouts        — weekly cron
16. recalc-provider-scores      — nightly cron
17. admin/*                     — admin operations
```

### First 10 Implementation Tasks

```
1. Initialize monorepo: package.json, turbo.json, .gitignore, folder structure
2. Initialize Supabase project: supabase init, config.toml
3. Write migration 00001_enums.sql with all enum types
4. Write migration 00002_users_profiles.sql
5. Write migration 00003_providers.sql
6. Write migration 00004_services.sql
7. Write migration 00005_addresses.sql
8. Write migration 00006_bookings.sql (including slot_locks and status_history)
9. Write migration 00012_functions.sql (helper functions for RLS)
10. Write migration 00013_rls_policies.sql (Phase 1 tables: users, profiles, services)
```
