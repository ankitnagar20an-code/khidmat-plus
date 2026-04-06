// ============================================
// Khidmat+ Shared Enum Types
// Must stay in sync with supabase/migrations/00001_enums.sql
// ============================================

export type UserRole = 'customer' | 'provider' | 'admin' | 'ops_manager';

export type BookingStatus =
  | 'draft'
  | 'slot_locked'
  | 'payment_pending'
  | 'payment_failed'
  | 'confirmed'
  | 'provider_assigned'
  | 'provider_accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_customer'
  | 'cancelled_by_provider'
  | 'cancelled_by_admin'
  | 'no_show'
  | 'disputed'
  | 'refunded';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | 'refund_pending'
  | 'refunded'
  | 'partially_refunded';

export type ProviderStatus =
  | 'pending_onboarding'
  | 'documents_submitted'
  | 'under_review'
  | 'approved'
  | 'active'
  | 'paused'
  | 'suspended'
  | 'deactivated';

export type VerificationStatus =
  | 'not_submitted'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

export type PayoutStatus =
  | 'pending'
  | 'eligible'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'on_hold';

export type NotificationChannel =
  | 'in_app'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'push';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_customer'
  | 'waiting_provider'
  | 'escalated'
  | 'resolved'
  | 'closed';

export type DocumentType =
  | 'national_id'
  | 'emirates_id'
  | 'passport'
  | 'professional_license'
  | 'certification'
  | 'background_check'
  | 'insurance';

export type DiscountType = 'percentage' | 'fixed_amount';

export type WalletEntryType =
  | 'earning'
  | 'cancellation_fee'
  | 'bonus'
  | 'payout'
  | 'adjustment'
  | 'penalty';
