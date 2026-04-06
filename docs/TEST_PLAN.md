# Khidmat+ Test Plan — Slot Locking & Double-Booking Prevention

## Overview

The booking engine's integrity depends on three guarantees:
1. **No double-booking**: Two customers cannot book the same provider at the same time
2. **Slot locks are respected**: A locked slot is not shown as available to other customers
3. **Expired locks are cleaned up**: Abandoned checkout flows release slots within 60 seconds

---

## Test Suite 1: Slot Lock Acquisition

### Test 1.1: Basic slot lock succeeds
```
Given: Provider A is available Mon 9:00-17:00, no existing bookings
When: Customer 1 calls lock-slot for Provider A at Mon 10:00
Then: Returns booking_id, lock_expires_at = now + 10min
  And: booking_slot_locks row created with released_at = NULL
  And: bookings row created with status = 'slot_locked'
```

### Test 1.2: Lock on already-locked slot fails
```
Given: Customer 1 has active lock on Provider A at Mon 10:00-11:00
When: Customer 2 calls lock-slot for Provider A at Mon 10:00
Then: Returns 409 SLOT_LOCKED error
  And: No new booking or lock created
```

### Test 1.3: Lock on booked slot fails
```
Given: Provider A has confirmed booking Mon 10:00-11:00
When: Customer calls lock-slot for Provider A at Mon 10:00
Then: Returns 409 SLOT_TAKEN error
```

### Test 1.4: Lock respects buffer time
```
Given: Provider A has confirmed booking Mon 10:00-11:00 (buffer=15min)
When: Customer calls lock-slot for Provider A at Mon 11:00
Then: Returns 409 SLOT_TAKEN (buffer extends to 11:15)
When: Customer calls lock-slot for Provider A at Mon 11:15
Then: Succeeds (no overlap with buffered range)
```

### Test 1.5: Lock on past time fails
```
When: Customer calls lock-slot with start_time in the past
Then: Returns 400 INVALID_TIME error
```

### Test 1.6: Lock requires active provider
```
Given: Provider A has status = 'paused'
When: Customer calls lock-slot for Provider A
Then: Returns 404 PROVIDER_NOT_AVAILABLE
```

---

## Test Suite 2: Concurrent Lock Requests

### Test 2.1: Race condition — two simultaneous locks
```
Given: Provider A is available Mon 10:00-11:00
When: Customer 1 and Customer 2 simultaneously call lock-slot for same slot
Then: Exactly one succeeds, one gets 409
  And: Only one booking_slot_locks row exists
  And: Only one bookings row exists
```

### Test 2.2: 10 concurrent requests for same slot
```
Given: Provider A is available
When: 10 customers simultaneously lock-slot for same time
Then: Exactly 1 succeeds, 9 get 409
  And: Database has exactly 1 active lock
```

### Test 2.3: Concurrent locks for different providers succeed
```
Given: Provider A and Provider B both available Mon 10:00
When: Customer 1 locks Provider A, Customer 2 locks Provider B
Then: Both succeed
  And: Two separate bookings and locks created
```

---

## Test Suite 3: Slot Lock Expiry

### Test 3.1: Lock expires after 10 minutes
```
Given: Customer 1 has lock created at T=0 (expires at T+10min)
When: Expiry cron runs at T+11min
Then: booking_slot_locks.released_at is set
  And: bookings.status changed to 'draft'
  And: Slot is now available for others
```

### Test 3.2: Lock expiry allows re-lock
```
Given: Customer 1's lock has expired
When: Customer 2 calls lock-slot for same slot
Then: Succeeds
```

### Test 3.3: Successful payment prevents expiry
```
Given: Customer 1 has lock, payment confirms at T+5min
When: Expiry cron runs at T+11min
Then: Lock has released_at set (from payment confirmation)
  And: Booking is 'confirmed' (not 'draft')
```

---

## Test Suite 4: Double-Booking Prevention (Database Level)

### Test 4.1: Direct INSERT with overlapping time rejected
```
Given: Booking exists for Provider A, Mon 10:00-11:00, status=confirmed
When: Direct INSERT of another booking for Provider A, Mon 10:30-11:30
Then: Trigger raises BOOKING_OVERLAP exception
  And: INSERT fails
```

### Test 4.2: UPDATE to overlapping time rejected
```
Given: Booking B1 for Provider A Mon 10:00-11:00 (confirmed)
  And: Booking B2 for Provider A Mon 14:00-15:00 (confirmed)
When: UPDATE B2 SET start_time = Mon 10:30
Then: Trigger raises BOOKING_OVERLAP exception
  And: UPDATE fails
```

### Test 4.3: Cancelled bookings don't block new ones
```
Given: Booking for Provider A Mon 10:00-11:00, status=cancelled_by_customer
When: New booking for Provider A Mon 10:00-11:00
Then: Succeeds (cancelled bookings excluded from overlap check)
```

### Test 4.4: Draft bookings don't block new ones
```
Given: Booking for Provider A Mon 10:00-11:00, status=draft (expired lock)
When: New booking for Provider A Mon 10:00-11:00
Then: Succeeds (draft bookings excluded from overlap check)
```

---

## Test Suite 5: Booking Status Transitions

### Test 5.1: Valid transitions succeed
```
draft → slot_locked ✓
slot_locked → payment_pending ✓
payment_pending → confirmed ✓
confirmed → provider_assigned ✓
provider_assigned → provider_accepted ✓
provider_accepted → in_progress ✓
in_progress → completed ✓
```

### Test 5.2: Invalid transitions rejected
```
draft → confirmed ✗ (must go through slot_locked → payment)
confirmed → completed ✗ (must go through provider flow)
completed → draft ✗ (no going back)
in_progress → draft ✗ (no going back)
```

### Test 5.3: Cancellation transitions valid from correct states
```
draft → cancelled_by_customer ✓
confirmed → cancelled_by_customer ✓
provider_assigned → cancelled_by_provider ✓
completed → cancelled_by_customer ✗ (cannot cancel after completion)
```

---

## Test Suite 6: Auto-Assignment

### Test 6.1: Best-available selects highest-scored provider
```
Given: Provider A (reliability=90, rating=4.5)
  And: Provider B (reliability=80, rating=4.8)
  And: Both available Mon 10:00
When: Customer creates booking without provider_id
Then: Provider A or B selected based on weighted score
  And: Booking created with selected provider_id
```

### Test 6.2: Unavailable providers excluded
```
Given: Provider A (blocked Mon 10:00)
  And: Provider B (available Mon 10:00)
When: Auto-assignment for Mon 10:00
Then: Provider B selected (A excluded due to block)
```

### Test 6.3: No available provider returns error
```
Given: All providers blocked or booked Mon 10:00
When: Auto-assignment for Mon 10:00
Then: Returns NO_PROVIDER_AVAILABLE error
```

---

## Test Suite 7: Cancellation + Refund

### Test 7.1: Refund percentages by time window
```
> 24h before start → 100% refund
12-24h before start → 50% refund
6-12h before start → 25% refund
< 6h before start → 0% refund
```

### Test 7.2: Provider cancellation always gives full refund
```
Given: Booking confirmed, 2h before start
When: Provider cancels
Then: Customer gets 100% refund (regardless of time window)
  And: Provider cancellation count incremented
```

### Test 7.3: Cancellation releases slot lock
```
Given: Booking with active slot lock
When: Customer cancels
Then: booking_slot_locks.released_at set
  And: Slot available for others
```

---

## Running Tests

```bash
# Unit tests (money calculations, status transitions)
npx vitest run --filter "unit"

# Integration tests (requires local Supabase)
npx supabase start
npx vitest run --filter "integration"

# Load tests (concurrent slot locking)
k6 run scripts/load-test-slot-lock.js

# RLS audit
npx vitest run --filter "rls"
```

## Test File Structure

```
tests/
├── unit/
│   ├── money.test.ts              # Price calculation, refund calculation
│   ├── booking-transitions.test.ts # Valid/invalid state transitions
│   └── slot-generation.test.ts     # Availability → slot generation
├── integration/
│   ├── lock-slot.test.ts           # Slot locking + expiry
│   ├── create-booking.test.ts      # Full booking creation
│   ├── cancel-booking.test.ts      # Cancellation + refund
│   ├── double-booking.test.ts      # Concurrent booking prevention
│   ├── provider-accept.test.ts     # Provider acceptance flow
│   └── rls-policies.test.ts        # Cross-user data leakage checks
└── load/
    └── slot-lock.k6.js             # 50 concurrent lock requests
```
