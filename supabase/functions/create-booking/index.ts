import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { requireAuth } from '../_shared/auth.ts';
import { AppError, errorResponse, jsonResponse } from '../_shared/errors.ts';
import { calculateBookingPrice } from '../_shared/money.ts';

/**
 * create-booking: Finalize a locked slot into a payable booking.
 *
 * Takes a locked booking, applies coupon/tax, and moves to payment_pending.
 * This is called after lock-slot succeeds and before payment.
 *
 * Auth: Customer JWT required
 * Idempotent: Yes (via idempotency_key)
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

    const {
      service_id,
      variant_id,
      provider_id,
      start_time,
      address_id,
      coupon_code,
      notes,
      idempotency_key,
    } = body;

    if (!service_id || !start_time || !idempotency_key) {
      throw new AppError('MISSING_FIELDS', 'service_id, start_time, and idempotency_key are required');
    }

    const supabase = createServiceClient();

    // 1. Idempotency check: return existing booking if key matches
    const { data: existing } = await supabase
      .from('bookings')
      .select('id, booking_number, total_fils, service_price_fils, discount_fils, tax_fils')
      .eq('idempotency_key', idempotency_key)
      .single();

    if (existing) {
      return jsonResponse({
        booking_id: existing.id,
        booking_number: existing.booking_number,
        breakdown: {
          service_price_fils: existing.service_price_fils,
          discount_fils: existing.discount_fils,
          tax_fils: existing.tax_fils,
          total_fils: existing.total_fils,
        },
      });
    }

    // 2. Validate service
    const { data: service, error: serviceErr } = await supabase
      .from('services')
      .select('id, base_price_fils, base_duration_minutes, buffer_minutes, is_online, requires_address, category_id')
      .eq('id', service_id)
      .eq('is_active', true)
      .single();

    if (serviceErr || !service) {
      throw new AppError('SERVICE_NOT_FOUND', 'Service not found or inactive', 404);
    }

    // 3. Get variant if specified
    let durationMinutes = service.base_duration_minutes;
    let priceFils = service.base_price_fils;

    if (variant_id) {
      const { data: variant } = await supabase
        .from('service_variants')
        .select('duration_minutes, price_fils')
        .eq('id', variant_id)
        .eq('service_id', service_id)
        .eq('is_active', true)
        .single();

      if (!variant) {
        throw new AppError('VARIANT_NOT_FOUND', 'Service variant not found', 404);
      }
      durationMinutes = variant.duration_minutes;
      priceFils = variant.price_fils;
    }

    // 4. Validate address if needed
    if (service.requires_address) {
      if (!address_id) {
        throw new AppError('ADDRESS_REQUIRED', 'This service requires a delivery address');
      }
      const { data: address } = await supabase
        .from('addresses')
        .select('id')
        .eq('id', address_id)
        .eq('user_id', user.id)
        .single();

      if (!address) {
        throw new AppError('ADDRESS_NOT_FOUND', 'Address not found', 404);
      }
    }

    // 5. Resolve provider
    let selectedProviderId = provider_id;
    let commissionRateBps = 2000; // default 20%

    if (selectedProviderId) {
      const { data: provider } = await supabase
        .from('providers')
        .select('id, commission_rate_bps, is_instant_book')
        .eq('id', selectedProviderId)
        .eq('status', 'active')
        .single();

      if (!provider) {
        throw new AppError('PROVIDER_NOT_AVAILABLE', 'Selected provider is not available', 404);
      }
      commissionRateBps = provider.commission_rate_bps;
    }

    // 6. Apply coupon
    let discountFils = 0;
    let couponId: string | null = null;

    if (coupon_code) {
      const couponResult = await validateAndApplyCoupon(supabase, {
        code: coupon_code,
        userId: user.id,
        serviceId: service_id,
        categoryId: service.category_id,
        priceFils,
      });
      discountFils = couponResult.discountFils;
      couponId = couponResult.couponId;
    }

    // 7. Calculate price breakdown
    const breakdown = calculateBookingPrice({
      servicePriceFils: priceFils,
      discountFils,
      commissionRateBps,
    });

    // 8. Calculate times
    const startTimeDt = new Date(start_time);
    const endTimeDt = new Date(startTimeDt.getTime() + durationMinutes * 60 * 1000);

    // 9. Generate booking number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const bookingNumber = `KH-${dateStr}-${randPart}`;

    // 10. Create booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        booking_number: bookingNumber,
        customer_id: user.id,
        provider_id: selectedProviderId || null,
        service_id,
        variant_id: variant_id || null,
        address_id: address_id || null,
        start_time: startTimeDt.toISOString(),
        end_time: endTimeDt.toISOString(),
        buffer_minutes: service.buffer_minutes,
        timezone: 'Asia/Dubai',
        service_price_fils: breakdown.service_price_fils,
        discount_fils: breakdown.discount_fils,
        tax_fils: breakdown.tax_fils,
        total_fils: breakdown.total_fils,
        platform_fee_fils: breakdown.platform_fee_fils,
        provider_payout_fils: breakdown.provider_payout_fils,
        status: 'slot_locked',
        is_online: service.is_online,
        coupon_id: couponId,
        idempotency_key,
        notes: notes || null,
      })
      .select('id, booking_number')
      .single();

    if (bookingErr) {
      if (bookingErr.message?.includes('BOOKING_OVERLAP')) {
        throw new AppError('SLOT_TAKEN', 'This time slot conflicts with an existing booking', 409);
      }
      if (bookingErr.message?.includes('duplicate key')) {
        throw new AppError('DUPLICATE_KEY', 'Booking with this idempotency key already exists', 409);
      }
      throw new AppError('BOOKING_CREATE_FAILED', bookingErr.message, 500);
    }

    // 11. Create slot lock (10 minute TTL)
    const lockExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await supabase.from('booking_slot_locks').insert({
      booking_id: booking.id,
      provider_id: selectedProviderId || null,
      start_time: startTimeDt.toISOString(),
      end_time: endTimeDt.toISOString(),
      locked_by: user.id,
      expires_at: lockExpiresAt.toISOString(),
    });

    // 12. Record coupon usage
    if (couponId) {
      await supabase.from('coupon_usages').insert({
        coupon_id: couponId,
        user_id: user.id,
        booking_id: booking.id,
      });

      await supabase.rpc('increment_coupon_usage', { p_coupon_id: couponId });
    }

    return jsonResponse({
      booking_id: booking.id,
      booking_number: booking.booking_number,
      lock_expires_at: lockExpiresAt.toISOString(),
      breakdown: {
        service_price_fils: breakdown.service_price_fils,
        discount_fils: breakdown.discount_fils,
        tax_fils: breakdown.tax_fils,
        total_fils: breakdown.total_fils,
      },
    });

  } catch (error) {
    return errorResponse(error);
  }
});

/**
 * Validate a coupon code and calculate discount.
 */
async function validateAndApplyCoupon(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    code: string;
    userId: string;
    serviceId: string;
    categoryId: string;
    priceFils: number;
  }
): Promise<{ discountFils: number; couponId: string }> {
  const { code, userId, serviceId, categoryId, priceFils } = params;

  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .lte('valid_from', new Date().toISOString())
    .gte('valid_until', new Date().toISOString())
    .single();

  if (!coupon) {
    throw new AppError('INVALID_COUPON', 'Coupon code is invalid or expired');
  }

  // Check usage limit
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    throw new AppError('COUPON_EXHAUSTED', 'This coupon has reached its usage limit');
  }

  // Check per-user limit
  const { count } = await supabase
    .from('coupon_usages')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', coupon.id)
    .eq('user_id', userId);

  if ((count ?? 0) >= coupon.per_user_limit) {
    throw new AppError('COUPON_USER_LIMIT', 'You have already used this coupon');
  }

  // Check min order
  if (priceFils < coupon.min_order_fils) {
    throw new AppError('COUPON_MIN_ORDER', `Minimum order of ${coupon.min_order_fils} fils required`);
  }

  // Check service/category applicability
  if (coupon.applicable_services && !coupon.applicable_services.includes(serviceId)) {
    throw new AppError('COUPON_NOT_APPLICABLE', 'This coupon is not valid for this service');
  }
  if (coupon.applicable_categories && !coupon.applicable_categories.includes(categoryId)) {
    throw new AppError('COUPON_NOT_APPLICABLE', 'This coupon is not valid for this category');
  }

  // Calculate discount
  let discountFils: number;
  if (coupon.discount_type === 'percentage') {
    discountFils = Math.round((priceFils * coupon.discount_value) / 100);
    if (coupon.max_discount_fils) {
      discountFils = Math.min(discountFils, coupon.max_discount_fils);
    }
  } else {
    discountFils = coupon.discount_value;
  }

  // Don't let discount exceed price
  discountFils = Math.min(discountFils, priceFils);

  return { discountFils, couponId: coupon.id };
}
