-- ============================================
-- Migration: 00001_enums
-- Purpose: Create all enum types used across the system
-- ============================================

-- User roles
CREATE TYPE user_role AS ENUM (
  'customer',
  'provider',
  'admin',
  'ops_manager'
);

-- Booking lifecycle states
CREATE TYPE booking_status AS ENUM (
  'draft',
  'slot_locked',
  'payment_pending',
  'payment_failed',
  'confirmed',
  'provider_assigned',
  'provider_accepted',
  'in_progress',
  'completed',
  'cancelled_by_customer',
  'cancelled_by_provider',
  'cancelled_by_admin',
  'no_show',
  'disputed',
  'refunded'
);

-- Payment lifecycle states
CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'expired',
  'refund_pending',
  'refunded',
  'partially_refunded'
);

-- Provider lifecycle states
CREATE TYPE provider_status AS ENUM (
  'pending_onboarding',
  'documents_submitted',
  'under_review',
  'approved',
  'active',
  'paused',
  'suspended',
  'deactivated'
);

-- Document verification states
CREATE TYPE verification_status AS ENUM (
  'not_submitted',
  'pending',
  'approved',
  'rejected',
  'expired'
);

-- Payout states
CREATE TYPE payout_status AS ENUM (
  'pending',
  'eligible',
  'processing',
  'completed',
  'failed',
  'on_hold'
);

-- Notification delivery channels
CREATE TYPE notification_channel AS ENUM (
  'in_app',
  'email',
  'sms',
  'whatsapp',
  'push'
);

-- Days of week for availability rules
CREATE TYPE day_of_week AS ENUM (
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
);

-- Support ticket states
CREATE TYPE ticket_status AS ENUM (
  'open',
  'in_progress',
  'waiting_customer',
  'waiting_provider',
  'escalated',
  'resolved',
  'closed'
);
