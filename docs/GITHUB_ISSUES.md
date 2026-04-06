# Khidmat+ GitHub Issues — Grouped by Milestone

## Milestone v0.1 — Schema + Auth Foundation

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| KH-001 | Create enum types migration | `scope:db`, `phase:1` | critical |
| KH-002 | Create users + user_profiles tables with triggers | `scope:db`, `phase:1` | critical |
| KH-003 | Create providers + profiles + verifications tables | `scope:db`, `phase:1` | critical |
| KH-004 | Set up Supabase Auth with phone OTP + email | `scope:auth`, `phase:1` | critical |
| KH-005 | Create auth trigger: auto-create user + profile on signup | `scope:auth`, `scope:db`, `phase:1` | critical |
| KH-006 | Create RLS helper functions (current_user_role, is_admin_or_ops, current_provider_id) | `scope:db`, `scope:auth`, `phase:1` | critical |
| KH-007 | Implement RLS policies for users, user_profiles, providers | `scope:db`, `scope:auth`, `phase:1` | critical |
| KH-008 | Initialize Next.js project with Supabase client setup | `scope:auth`, `type:chore`, `phase:1` | high |
| KH-009 | Generate TypeScript types from Supabase schema | `type:chore`, `phase:1` | high |
| KH-010 | Create shared Edge Function utilities (_shared/) | `type:chore`, `phase:1` | high |

## Milestone v0.2 — Service Catalog + Provider Model

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| KH-011 | Create service_categories, services, service_variants tables | `scope:db`, `phase:2` | critical |
| KH-012 | Create provider_services + provider_service_areas tables | `scope:db`, `phase:2` | critical |
| KH-013 | Create provider_availability_rules + blocked_slots tables | `scope:db`, `phase:2` | critical |
| KH-014 | Seed service categories and initial services | `scope:db`, `type:chore`, `phase:2` | high |
| KH-015 | RLS policies for services (public read) + provider tables | `scope:db`, `phase:2` | critical |
| KH-016 | Provider verification table + Storage bucket for KYC docs | `scope:db`, `scope:provider`, `phase:2` | high |
| KH-017 | Edge function: provider onboarding / profile submission | `scope:provider`, `phase:2` | medium |

## Milestone v0.3 — Booking Engine Core

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| KH-018 | Create bookings + booking_status_history tables | `scope:db`, `scope:booking`, `phase:3` | critical |
| KH-019 | Create booking_slot_locks table | `scope:db`, `scope:booking`, `phase:3` | critical |
| KH-020 | Create addresses table with default-address trigger | `scope:db`, `phase:3` | high |
| KH-021 | Implement double-booking prevention trigger | `scope:db`, `scope:booking`, `phase:3` | critical |
| KH-022 | Implement booking status transition validator trigger | `scope:db`, `scope:booking`, `phase:3` | critical |
| KH-023 | Edge function: get-available-slots | `scope:booking`, `phase:3` | critical |
| KH-024 | Edge function: lock-slot | `scope:booking`, `phase:3` | critical |
| KH-025 | Edge function: create-booking (with coupon support) | `scope:booking`, `phase:3` | critical |
| KH-026 | Auto-assignment algorithm (best-available provider) | `scope:booking`, `phase:3` | critical |
| KH-027 | Edge function: cancel-booking with refund calculation | `scope:booking`, `phase:3` | high |
| KH-028 | Edge function: reschedule-booking | `scope:booking`, `phase:3` | high |
| KH-029 | Slot lock expiry cron job (every 60s) | `scope:booking`, `type:chore`, `phase:3` | critical |
| KH-030 | RLS policies for bookings, slot_locks, addresses | `scope:db`, `scope:booking`, `phase:3` | critical |

## Milestone v0.4 — Provider Operations

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| KH-031 | Edge function: provider-accept-booking | `scope:provider`, `phase:4` | critical |
| KH-032 | Edge function: provider-decline-booking + auto-reassign | `scope:provider`, `scope:booking`, `phase:4` | critical |
| KH-033 | Edge function: complete-booking | `scope:provider`, `scope:booking`, `phase:4` | critical |
| KH-034 | Provider auto-decline cron (30-min timeout) | `scope:provider`, `phase:4` | high |
| KH-035 | Reliability score calculation function | `scope:provider`, `phase:4` | high |
| KH-036 | Nightly recalc-provider-scores cron | `scope:provider`, `type:chore`, `phase:4` | high |
| KH-037 | Provider pause/resume functionality | `scope:provider`, `phase:4` | medium |

## Milestone v0.5 — Admin Panel Backend

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| KH-038 | Admin RLS policies (admin/ops roles) | `scope:db`, `scope:admin`, `phase:5` | critical |
| KH-039 | Edge function: admin/approve-provider | `scope:admin`, `scope:provider`, `phase:5` | critical |
| KH-040 | Edge function: admin/suspend-provider | `scope:admin`, `scope:provider`, `phase:5` | critical |
| KH-041 | Edge function: admin/reassign-booking | `scope:admin`, `scope:booking`, `phase:5` | high |
| KH-042 | Create support_tickets + admin_notes tables | `scope:db`, `scope:admin`, `phase:5` | high |
| KH-043 | Create audit_logs table + admin logging triggers | `scope:db`, `scope:admin`, `phase:5` | high |
| KH-044 | Admin service/pricing CRUD | `scope:admin`, `phase:5` | medium |

## Milestone v0.6 — Payments + Payouts

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| KH-045 | Create payments table | `scope:db`, `scope:payment`, `phase:6` | critical |
| KH-046 | Create payouts + provider_wallet_ledger tables | `scope:db`, `scope:payment`, `phase:6` | critical |
| KH-047 | Edge function: create-payment-intent (Stripe integration) | `scope:payment`, `phase:6` | critical |
| KH-048 | Edge function: confirm-payment (webhook handler) | `scope:payment`, `phase:6` | critical |
| KH-049 | Edge function: handle-payment-failure | `scope:payment`, `phase:6` | critical |
| KH-050 | Edge function: process-refund | `scope:payment`, `phase:6` | high |
| KH-051 | Payout eligibility logic (72h hold, 50 AED min) | `scope:payment`, `phase:6` | high |
| KH-052 | Edge function: run-provider-payouts (weekly cron) | `scope:payment`, `phase:6` | high |
| KH-053 | Create coupons + coupon_usages tables | `scope:db`, `scope:payment`, `phase:6` | medium |
| KH-054 | Coupon validation in booking creation | `scope:booking`, `scope:payment`, `phase:6` | medium |
| KH-055 | Payment expired cleanup cron (5-min stale payments) | `scope:payment`, `type:chore`, `phase:6` | high |

## Milestone v0.7 — Notifications + Trust

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| KH-056 | Create notifications table + RLS | `scope:db`, `scope:notif`, `phase:7` | critical |
| KH-057 | Notification insert triggers on booking events | `scope:notif`, `scope:db`, `phase:7` | high |
| KH-058 | Edge function: send-notifications (external dispatch) | `scope:notif`, `phase:7` | high |
| KH-059 | Supabase Realtime subscription for in-app notifications | `scope:notif`, `phase:7` | high |
| KH-060 | Create reviews table + RLS | `scope:db`, `phase:7` | high |
| KH-061 | Edge function: submit-review (with auto-rating update) | `scope:booking`, `phase:7` | high |
| KH-062 | Review moderation logic + admin flagging | `scope:admin`, `phase:7` | medium |
| KH-063 | Provider badge calculation | `scope:provider`, `phase:7` | medium |

## Milestone v0.8 — Hardening + QA

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| KH-064 | E2E booking flow test (slot→lock→pay→confirm→complete) | `type:test`, `phase:8` | critical |
| KH-065 | Load test: concurrent slot locking (50 requests) | `type:test`, `phase:8` | critical |
| KH-066 | RLS audit: verify no cross-user data leakage | `type:test`, `scope:auth`, `phase:8` | critical |
| KH-067 | Payment failure + recovery test | `type:test`, `scope:payment`, `phase:8` | critical |
| KH-068 | Timezone handling verification (Dubai/Riyadh) | `type:test`, `phase:8` | high |
| KH-069 | Error handling standardization across edge functions | `type:chore`, `phase:8` | high |
| KH-070 | Rate limiting on public endpoints | `type:chore`, `phase:8` | high |
| KH-071 | Production environment setup + secrets configuration | `type:chore`, `phase:8` | critical |
| KH-072 | Launch checklist verification | `type:chore`, `phase:8` | critical |

---

## PR Batches (Implementation Order)

### PR 1: Database Foundation
- Migrations 00001–00005 (enums, users, providers, services, addresses)
- RLS helper functions
- Updated_at triggers
- **Issues:** KH-001, KH-002, KH-003, KH-006

### PR 2: Auth + Signup
- Supabase Auth config
- Signup trigger (handle_new_user)
- Next.js Supabase client setup
- Basic RLS for users/profiles
- **Issues:** KH-004, KH-005, KH-007, KH-008

### PR 3: Service Catalog
- Service tables migration
- Seed data
- Public RLS for services
- TypeScript type generation
- **Issues:** KH-011, KH-014, KH-015, KH-009

### PR 4: Booking Tables + Constraints
- Bookings migration (tables, triggers, constraints)
- Double-booking prevention
- Status transition validator
- Slot lock table
- **Issues:** KH-018, KH-019, KH-020, KH-021, KH-022, KH-030

### PR 5: Booking Engine Functions
- Shared edge function utilities
- lock-slot function
- create-booking function
- get-available-slots function
- Auto-assignment algorithm
- **Issues:** KH-010, KH-023, KH-024, KH-025, KH-026

### PR 6: Booking Lifecycle Functions
- cancel-booking
- reschedule-booking
- Slot lock expiry cron
- **Issues:** KH-027, KH-028, KH-029

### PR 7: Provider Operations
- provider-accept-booking
- provider-decline-booking
- complete-booking
- Auto-decline cron
- **Issues:** KH-031, KH-032, KH-033, KH-034

### PR 8: Provider Scoring + Admin
- Reliability scoring
- Provider pause/resume
- Admin approval/suspension
- Admin reassignment
- **Issues:** KH-035, KH-036, KH-037, KH-038, KH-039, KH-040, KH-041

### PR 9: Payments
- Payment tables
- create-payment-intent
- confirm-payment webhook
- process-refund
- **Issues:** KH-045, KH-046, KH-047, KH-048, KH-049, KH-050

### PR 10: Payouts + Coupons
- Payout logic
- Weekly payout cron
- Coupon tables
- **Issues:** KH-051, KH-052, KH-053, KH-054, KH-055

### PR 11: Notifications + Reviews
- Notifications table
- Dispatch cron
- Realtime subscriptions
- Reviews table + function
- **Issues:** KH-056, KH-057, KH-058, KH-059, KH-060, KH-061

### PR 12: Hardening
- Tests
- Rate limiting
- Error standardization
- Production config
- **Issues:** KH-064 through KH-072
