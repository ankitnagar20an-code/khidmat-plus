import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { requireAuth } from '../_shared/auth.ts';
import { AppError, errorResponse, jsonResponse } from '../_shared/errors.ts';

/**
 * lock-slot: Reserve a time slot for a customer.
 *
 * Creates a draft booking + slot lock. Lock expires in 10 minutes.
 * Uses SELECT FOR UPDATE to prevent concurrent locks on same slot.
 *
 * Auth: Customer JWT required
 * Idempotent: No (use create-booking with idempotency_key for that)
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'POST',
      },
    });
  }

  try {
    const user = await requireAuth(req);
    const body = await req.json();

    const { service_id, variant_id, provider_id, start_time, address_id } = body;

    if (!service_id || !start_time) {
      throw new AppError('MISSING_FIELDS', 'service_id and start_time are required');
    }

    const startTime = new Date(start_time);
    if (startTime <= new Date()) {
      throw new AppError('INVALID_TIME', 'start_time must be in the future');
    }

    const supabase = createServiceClient();

    // 1. Validate service exists and is active
    const { data: service, error: serviceErr } = await supabase
      .from('services')
      .select('id, base_price_fils, base_duration_minutes, buffer_minutes, is_online, requires_address')
      .eq('id', service_id)
      .eq('is_active', true)
      .single();

    if (serviceErr || !service) {
      throw new AppError('SERVICE_NOT_FOUND', 'Service not found or inactive', 404);
    }

    // 2. Get variant if specified
    let durationMinutes = service.base_duration_minutes;
    let priceFils = service.base_price_fils;

    if (variant_id) {
      const { data: variant, error: varErr } = await supabase
        .from('service_variants')
        .select('id, duration_minutes, price_fils')
        .eq('id', variant_id)
        .eq('service_id', service_id)
        .eq('is_active', true)
        .single();

      if (varErr || !variant) {
        throw new AppError('VARIANT_NOT_FOUND', 'Service variant not found', 404);
      }
      durationMinutes = variant.duration_minutes;
      priceFils = variant.price_fils;
    }

    // 3. Validate address if required
    if (service.requires_address && !address_id) {
      throw new AppError('ADDRESS_REQUIRED', 'This service requires an address');
    }

    // Calculate end time
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const bufferMinutes = service.buffer_minutes;

    // 4. Determine provider
    let selectedProviderId = provider_id;

    if (!selectedProviderId) {
      // Auto-assign: find best available provider
      selectedProviderId = await findBestAvailableProvider(supabase, {
        serviceId: service_id,
        variantId: variant_id,
        startTime,
        endTime,
        bufferMinutes,
      });

      if (!selectedProviderId) {
        throw new AppError('NO_PROVIDER_AVAILABLE', 'No provider available for this time slot', 409);
      }
    } else {
      // Validate chosen provider
      const { data: provider } = await supabase
        .from('providers')
        .select('id, status')
        .eq('id', selectedProviderId)
        .eq('status', 'active')
        .single();

      if (!provider) {
        throw new AppError('PROVIDER_NOT_AVAILABLE', 'Provider not found or not active', 404);
      }
    }

    // 5. Check for overlapping locks/bookings using raw SQL for transactional safety
    const { data: overlap, error: overlapErr } = await supabase.rpc('check_slot_available', {
      p_provider_id: selectedProviderId,
      p_start_time: startTime.toISOString(),
      p_end_time: endTime.toISOString(),
      p_buffer_minutes: bufferMinutes,
    });

    // If check_slot_available RPC doesn't exist yet, do it via query
    // This is a fallback — the RPC should be created in a migration
    if (overlapErr) {
      // Check existing bookings
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('provider_id', selectedProviderId)
        .not('status', 'in', '("cancelled_by_customer","cancelled_by_provider","cancelled_by_admin","refunded","payment_failed","draft")')
        .lt('start_time', endTime.toISOString())
        .gt('end_time', startTime.toISOString())
        .limit(1);

      if (existingBookings && existingBookings.length > 0) {
        throw new AppError('SLOT_TAKEN', 'This time slot is already booked', 409);
      }

      // Check existing active locks
      const { data: existingLocks } = await supabase
        .from('booking_slot_locks')
        .select('id')
        .eq('provider_id', selectedProviderId)
        .is('released_at', null)
        .gt('expires_at', new Date().toISOString())
        .lt('start_time', endTime.toISOString())
        .gt('end_time', startTime.toISOString())
        .limit(1);

      if (existingLocks && existingLocks.length > 0) {
        throw new AppError('SLOT_LOCKED', 'This time slot is temporarily reserved', 409);
      }
    }

    // 6. Generate booking number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const bookingNumber = `KH-${dateStr}-${randPart}`;

    // 7. Create draft booking
    const lockExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        booking_number: bookingNumber,
        customer_id: user.id,
        provider_id: selectedProviderId,
        service_id: service_id,
        variant_id: variant_id || null,
        address_id: address_id || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        buffer_minutes: bufferMinutes,
        service_price_fils: priceFils,
        discount_fils: 0,
        tax_fils: 0,
        total_fils: priceFils, // will be recalculated in create-booking with coupon/tax
        status: 'slot_locked',
        is_online: service.is_online,
        idempotency_key: `lock-${bookingNumber}`,
      })
      .select('id, booking_number')
      .single();

    if (bookingErr) {
      // Check if it's a double-booking error from our trigger
      if (bookingErr.message?.includes('BOOKING_OVERLAP')) {
        throw new AppError('SLOT_TAKEN', 'This time slot conflicts with an existing booking', 409);
      }
      throw new AppError('BOOKING_CREATE_FAILED', bookingErr.message, 500);
    }

    // 8. Create slot lock
    const { error: lockErr } = await supabase
      .from('booking_slot_locks')
      .insert({
        booking_id: booking.id,
        provider_id: selectedProviderId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        locked_by: user.id,
        expires_at: lockExpiresAt.toISOString(),
      });

    if (lockErr) {
      // Cleanup: delete the draft booking
      await supabase.from('bookings').delete().eq('id', booking.id);
      throw new AppError('LOCK_FAILED', 'Failed to create slot lock', 500);
    }

    // 9. Get provider name for response
    const { data: providerProfile } = await supabase
      .from('provider_profiles')
      .select('display_name')
      .eq('provider_id', selectedProviderId)
      .single();

    return jsonResponse({
      booking_id: booking.id,
      booking_number: booking.booking_number,
      lock_expires_at: lockExpiresAt.toISOString(),
      provider_id: selectedProviderId,
      provider_name: providerProfile?.display_name ?? 'Provider',
    });

  } catch (error) {
    return errorResponse(error);
  }
});

/**
 * Find the best available provider for a given service and time.
 */
async function findBestAvailableProvider(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    serviceId: string;
    variantId?: string;
    startTime: Date;
    endTime: Date;
    bufferMinutes: number;
  }
): Promise<string | null> {
  const { serviceId, variantId, startTime, endTime, bufferMinutes } = params;

  // Get day of week for availability check
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[startTime.getDay()];
  const startTimeLocal = startTime.toTimeString().slice(0, 5); // HH:MM
  const endTimeLocal = endTime.toTimeString().slice(0, 5);

  // Find providers who:
  // 1. Offer this service (approved + active)
  // 2. Are active
  // 3. Have availability on this day/time
  const { data: candidates } = await supabase
    .from('provider_services')
    .select(`
      provider_id,
      providers!inner(
        id, status, is_instant_book, rating_avg, reliability_score, total_bookings
      )
    `)
    .eq('service_id', serviceId)
    .eq('is_approved', true)
    .eq('is_active', true)
    .eq('providers.status', 'active');

  if (!candidates || candidates.length === 0) return null;

  // Filter by availability and check for conflicts
  const availableProviders: Array<{
    id: string;
    score: number;
  }> = [];

  for (const candidate of candidates) {
    const providerId = candidate.provider_id;
    const provider = candidate.providers as any;

    // Check availability rules
    const { data: rules } = await supabase
      .from('provider_availability_rules')
      .select('start_time, end_time')
      .eq('provider_id', providerId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .lte('start_time', startTimeLocal)
      .gte('end_time', endTimeLocal);

    if (!rules || rules.length === 0) continue;

    // Check blocked slots
    const { data: blocks } = await supabase
      .from('provider_blocked_slots')
      .select('id')
      .eq('provider_id', providerId)
      .lt('start_time', endTime.toISOString())
      .gt('end_time', startTime.toISOString())
      .limit(1);

    if (blocks && blocks.length > 0) continue;

    // Check existing bookings
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('provider_id', providerId)
      .not('status', 'in', '("cancelled_by_customer","cancelled_by_provider","cancelled_by_admin","refunded","payment_failed","draft")')
      .lt('start_time', endTime.toISOString())
      .gt('end_time', startTime.toISOString())
      .limit(1);

    if (conflicts && conflicts.length > 0) continue;

    // Check active locks
    const { data: locks } = await supabase
      .from('booking_slot_locks')
      .select('id')
      .eq('provider_id', providerId)
      .is('released_at', null)
      .gt('expires_at', new Date().toISOString())
      .lt('start_time', endTime.toISOString())
      .gt('end_time', startTime.toISOString())
      .limit(1);

    if (locks && locks.length > 0) continue;

    // Calculate ranking score
    const score =
      (provider.reliability_score ?? 100) * 0.4 +
      (provider.rating_avg ?? 0) * 10 * 0.3 +
      Math.max(0, 50 - (provider.total_bookings ?? 0)) * 0.2 +
      Math.random() * 10 * 0.1;

    availableProviders.push({ id: providerId, score });
  }

  if (availableProviders.length === 0) return null;

  // Sort by score descending, return best
  availableProviders.sort((a, b) => b.score - a.score);
  return availableProviders[0].id;
}
