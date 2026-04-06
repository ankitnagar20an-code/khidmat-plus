// ============================================
// Khidmat+ API Request/Response Types
// Used by both frontend and edge functions
// ============================================

import type { BookingStatus } from './enums';

// ---- Slot Fetching ----

export interface GetAvailableSlotsRequest {
  service_id: string;
  variant_id?: string;
  provider_id?: string; // null = show all providers' slots
  date: string;          // YYYY-MM-DD
  city: string;
}

export interface AvailableSlot {
  start_time: string;      // ISO 8601
  end_time: string;        // ISO 8601
  provider_id: string;
  provider_name: string;
  provider_avatar_url?: string;
  provider_rating: number;
  is_instant_book: boolean;
}

export interface GetAvailableSlotsResponse {
  slots: AvailableSlot[];
}

// ---- Booking Creation ----

export interface CreateBookingRequest {
  service_id: string;
  variant_id?: string;
  provider_id?: string; // null = best-available
  start_time: string;    // ISO 8601
  address_id?: string;   // required if service.requires_address
  coupon_code?: string;
  notes?: string;
  idempotency_key: string;
}

export interface BookingPriceBreakdown {
  service_price_fils: number;
  discount_fils: number;
  tax_fils: number;
  total_fils: number;
}

export interface CreateBookingResponse {
  booking_id: string;
  booking_number: string;
  lock_expires_at: string; // ISO 8601
  breakdown: BookingPriceBreakdown;
}

// ---- Lock Slot ----

export interface LockSlotRequest {
  service_id: string;
  variant_id?: string;
  provider_id?: string;
  start_time: string;
  address_id?: string;
}

export interface LockSlotResponse {
  booking_id: string;
  booking_number: string;
  lock_expires_at: string;
  provider_id: string;
  provider_name: string;
}

// ---- Payment ----

export interface CreatePaymentIntentRequest {
  booking_id: string;
}

export interface CreatePaymentIntentResponse {
  payment_id: string;
  client_secret: string; // Stripe client_secret or redirect URL
  amount_fils: number;
  currency: string;
}

export interface ConfirmPaymentWebhook {
  provider_ref: string;
  status: 'succeeded' | 'failed';
  amount_fils: number;
  metadata: Record<string, string>;
}

// ---- Cancel Booking ----

export interface CancelBookingRequest {
  booking_id: string;
  reason?: string;
}

export interface CancelBookingResponse {
  booking_id: string;
  new_status: BookingStatus;
  refund_amount_fils: number;
  refund_percent: number;
}

// ---- Reschedule ----

export interface RescheduleBookingRequest {
  booking_id: string;
  new_start_time: string; // ISO 8601
}

export interface RescheduleBookingResponse {
  new_booking_id: string;
  new_booking_number: string;
  lock_expires_at: string;
  old_booking_status: BookingStatus;
}

// ---- Provider Actions ----

export interface ProviderAcceptBookingRequest {
  booking_id: string;
}

export interface ProviderDeclineBookingRequest {
  booking_id: string;
  reason?: string;
}

export interface CompleteBookingRequest {
  booking_id: string;
}

// ---- Reviews ----

export interface SubmitReviewRequest {
  booking_id: string;
  rating: number; // 1-5
  comment?: string;
}

export interface SubmitReviewResponse {
  review_id: string;
}

// ---- Admin ----

export interface ApproveProviderRequest {
  provider_id: string;
}

export interface SuspendProviderRequest {
  provider_id: string;
  reason: string;
}

export interface AdminReassignBookingRequest {
  booking_id: string;
  new_provider_id: string;
}

export interface ApproveRefundRequest {
  booking_id: string;
  amount_fils: number;
  reason: string;
}

// ---- Common Response ----

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}
