# Khidmat+ Deployment Checklist

## Pre-Deployment: Vercel Setup

- [ ] Create Vercel project linked to GitHub repo
- [ ] Set framework preset to Next.js
- [ ] Set root directory to `apps/web`
- [ ] Configure build command: `npm run build`
- [ ] Configure output directory: `.next`
- [ ] Set Node.js version: 20.x

## Environment Variables: Vercel

### Production (scope: Production)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — production Supabase URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — production anon key
- [ ] `NEXT_PUBLIC_APP_URL` — `https://khidmatplus.com`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — live publishable key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — production service role key
- [ ] `STRIPE_SECRET_KEY` — live secret key
- [ ] `STRIPE_WEBHOOK_SECRET` — production webhook secret

### Preview (scope: Preview)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — staging Supabase URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — staging anon key
- [ ] `NEXT_PUBLIC_APP_URL` — `https://preview.khidmatplus.com`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — test publishable key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — staging service role key
- [ ] `STRIPE_SECRET_KEY` — test secret key

## Supabase Setup

### Production Project
- [ ] Create Supabase production project
- [ ] Apply all migrations in order (00001 through 00013)
- [ ] Run seed data (categories.sql)
- [ ] Verify all RLS policies are active
- [ ] Set up Supabase secrets for edge functions:
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `RESEND_API_KEY`
  - [ ] `TWILIO_ACCOUNT_SID`
  - [ ] `TWILIO_AUTH_TOKEN`
- [ ] Deploy all edge functions
- [ ] Enable pg_cron extension
- [ ] Schedule cron jobs:
  - [ ] Slot lock expiry (every 1 min)
  - [ ] Notification dispatch (every 30 sec)
  - [ ] Provider auto-decline (every 5 min)
  - [ ] Provider score recalc (daily 3am UTC+4)
  - [ ] Payment stale cleanup (every 5 min)
  - [ ] Weekly payout (Sunday 6am UTC+4)

### Staging Project
- [ ] Create Supabase staging project
- [ ] Mirror production migrations
- [ ] Seed with test data
- [ ] Deploy edge functions

### Auth Configuration
- [ ] Enable Phone Auth (OTP)
- [ ] Enable Email Auth
- [ ] Configure SMS provider (Twilio)
- [ ] Set JWT expiry (3600s recommended)
- [ ] Configure redirect URLs for auth

### Storage Buckets
- [ ] Create `avatars` bucket (public)
- [ ] Create `kyc-documents` bucket (private, admin-only read)
- [ ] Create `service-images` bucket (public)
- [ ] Set bucket policies

## Stripe / Payment Provider

- [ ] Create Stripe account
- [ ] Get live API keys
- [ ] Set up webhook endpoint: `https://<supabase-url>/functions/v1/confirm-payment`
- [ ] Subscribe to events: `payment_intent.succeeded`, `payment_intent.payment_failed`
- [ ] Verify webhook signature in edge function

## DNS / Domain

- [ ] Configure custom domain in Vercel
- [ ] Set up SSL (auto via Vercel)
- [ ] Configure Supabase custom domain (optional)

## GitHub

- [ ] Enable branch protection on `main`
  - [ ] Require PR reviews (1 minimum)
  - [ ] Require status checks (lint, typecheck, test)
  - [ ] No force push
  - [ ] Squash merge only
- [ ] Set up CI workflow (`.github/workflows/ci.yml`)
- [ ] Set up migration check workflow
- [ ] Create issue labels
- [ ] Create milestones (v0.1 through v1.0)

## Post-Deployment Verification

- [ ] Auth signup flow works (phone + email)
- [ ] Service catalog loads
- [ ] Provider discovery returns results
- [ ] Slot fetching returns available times
- [ ] Booking creation succeeds end-to-end
- [ ] Payment flow completes
- [ ] Cancellation + refund works
- [ ] Provider acceptance flow works
- [ ] Notifications delivered (in-app + email)
- [ ] Admin panel accessible
- [ ] RLS prevents cross-user data access
- [ ] Edge functions return proper error codes
- [ ] Cron jobs running on schedule

## Monitoring

- [ ] Set up Supabase Dashboard alerts (error rate, function failures)
- [ ] Set up Vercel analytics
- [ ] Set up Stripe webhook monitoring
- [ ] Create runbook for common incidents
