import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { requireAuth } from '../_shared/auth.ts';
import { AppError, errorResponse, jsonResponse } from '../_shared/errors.ts';

/**
 * provider-accept-booking: Provider accepts a booking assigned to them.
 *
 * Transitions booking from provider_assigned → provider_accepted.
 * Notifies the customer.
 *
 * Auth: Provider JWT required
 * Idempotent: Yes (accepting already-accepted booking returns success)
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

    if (user.role !== 'provider') {
      throw new AppError('UNAUTHORIZED', 'Only providers can accept bookings', 403);
    }

    const { booking_id } = await req.json();

    if (!booking_id) {
      throw new AppError('MISSING_FIELDS', 'booking_id is required');
    }

    const supabase = createServiceClient();

    // 1. Get provider record for this user
    const { data: provider, error: provErr } = await supabase
      .from('providers')
      .select('id, status')
      .eq('user_id', user.id)
      .single();

    if (provErr || !provider) {
      throw new AppError('PROVIDER_NOT_FOUND', 'Provider record not found', 404);
    }

    if (provider.status !== 'active') {
      throw new AppError('PROVIDER_INACTIVE', 'Your provider account is not active', 403);
    }

    // 2. Fetch booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, booking_number, status, provider_id, customer_id, start_time, service_id')
      .eq('id', booking_id)
      .single();

    if (bookingErr || !booking) {
      throw new AppError('BOOKING_NOT_FOUND', 'Booking not found', 404);
    }

    // 3. Verify this provider is assigned to this booking
    if (booking.provider_id !== provider.id) {
      throw new AppError('NOT_YOUR_BOOKING', 'This booking is not assigned to you', 403);
    }

    // 4. Idempotency: already accepted
    if (booking.status === 'provider_accepted') {
      return jsonResponse({
        booking_id: booking.id,
        status: 'provider_accepted',
        message: 'Booking already accepted',
      });
    }

    // 5. Validate current status allows acceptance
    if (booking.status !== 'provider_assigned') {
      throw new AppError(
        'INVALID_STATUS',
        `Cannot accept booking in ${booking.status} status. Expected: provider_assigned`,
        400
      );
    }

    // 6. Update booking status
    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ status: 'provider_accepted' })
      .eq('id', booking_id)
      .eq('status', 'provider_assigned'); // optimistic concurrency

    if (updateErr) {
      if (updateErr.message?.includes('INVALID_TRANSITION')) {
        throw new AppError('TRANSITION_FAILED', 'Booking status has changed, please refresh', 409);
      }
      throw new AppError('UPDATE_FAILED', updateErr.message, 500);
    }

    // 7. Notify customer
    const { data: service } = await supabase
      .from('services')
      .select('name')
      .eq('id', booking.service_id)
      .single();

    const { data: providerProfile } = await supabase
      .from('provider_profiles')
      .select('display_name')
      .eq('provider_id', provider.id)
      .single();

    await supabase.from('notifications').insert([
      {
        user_id: booking.customer_id,
        channel: 'in_app',
        title: 'Provider Confirmed',
        body: `${providerProfile?.display_name ?? 'Your provider'} has confirmed your ${service?.name ?? 'service'} booking for ${new Date(booking.start_time).toLocaleDateString('en-AE')}.`,
        data: { booking_id, type: 'provider_accepted' },
      },
      // Also queue push notification
      {
        user_id: booking.customer_id,
        channel: 'push',
        title: 'Provider Confirmed',
        body: `${providerProfile?.display_name ?? 'Your provider'} has confirmed your booking.`,
        data: { booking_id, type: 'provider_accepted' },
      },
    ]);

    // 8. Log audit
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'booking.provider_accepted',
      entity_type: 'booking',
      entity_id: booking_id,
      old_data: { status: 'provider_assigned' },
      new_data: { status: 'provider_accepted' },
    });

    return jsonResponse({
      booking_id: booking.id,
      status: 'provider_accepted',
    });

  } catch (error) {
    return errorResponse(error);
  }
});
