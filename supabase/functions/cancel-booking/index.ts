import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { requireAuth } from '../_shared/auth.ts';
import { AppError, errorResponse, jsonResponse } from '../_shared/errors.ts';
import { calculateRefundAmount } from '../_shared/money.ts';

/**
 * cancel-booking: Cancel a booking with refund calculation.
 *
 * Determines refund amount based on cancellation policy:
 * - >24h before start: 100% refund
 * - 12-24h: 50%
 * - 6-12h: 25%
 * - <6h: 0%
 * - Provider/admin cancel: always 100%
 *
 * Auth: Customer, Provider, or Admin JWT
 * Idempotent: Yes (cancelling already-cancelled booking returns current state)
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
    const { booking_id, reason } = await req.json();

    if (!booking_id) {
      throw new AppError('MISSING_FIELDS', 'booking_id is required');
    }

    const supabase = createServiceClient();

    // 1. Fetch booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('*, providers(user_id)')
      .eq('id', booking_id)
      .single();

    if (bookingErr || !booking) {
      throw new AppError('BOOKING_NOT_FOUND', 'Booking not found', 404);
    }

    // 2. Check if already cancelled
    const cancelledStatuses = [
      'cancelled_by_customer',
      'cancelled_by_provider',
      'cancelled_by_admin',
      'refunded',
    ];
    if (cancelledStatuses.includes(booking.status)) {
      return jsonResponse({
        booking_id: booking.id,
        new_status: booking.status,
        refund_amount_fils: 0,
        refund_percent: 0,
        message: 'Booking is already cancelled',
      });
    }

    // 3. Determine who is cancelling and validate permission
    let cancelStatus: string;
    let cancelledByRole: 'customer' | 'provider' | 'admin';

    if (user.role === 'admin' || user.role === 'ops_manager') {
      cancelStatus = 'cancelled_by_admin';
      cancelledByRole = 'admin';
    } else if (
      user.role === 'provider' &&
      booking.providers &&
      (booking.providers as any).user_id === user.id
    ) {
      cancelStatus = 'cancelled_by_provider';
      cancelledByRole = 'provider';
    } else if (booking.customer_id === user.id) {
      cancelStatus = 'cancelled_by_customer';
      cancelledByRole = 'customer';
    } else {
      throw new AppError('UNAUTHORIZED', 'You do not have permission to cancel this booking', 403);
    }

    // 4. Check if booking can be cancelled from current status
    const cancellableStatuses = [
      'draft', 'slot_locked', 'payment_pending', 'payment_failed',
      'confirmed', 'provider_assigned', 'provider_accepted',
    ];
    if (!cancellableStatuses.includes(booking.status)) {
      throw new AppError(
        'CANNOT_CANCEL',
        `Cannot cancel booking in ${booking.status} status`,
        400
      );
    }

    // 5. Calculate refund
    const { refundAmountFils, refundPercent } = calculateRefundAmount(
      booking.total_fils,
      new Date(booking.start_time),
      cancelledByRole
    );

    // No refund needed for pre-payment statuses
    const prePaymentStatuses = ['draft', 'slot_locked', 'payment_pending', 'payment_failed'];
    const needsRefund = !prePaymentStatuses.includes(booking.status) && refundAmountFils > 0;

    // 6. Update booking
    const { error: updateErr } = await supabase
      .from('bookings')
      .update({
        status: cancelStatus,
        cancellation_reason: reason || null,
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', booking_id);

    if (updateErr) {
      if (updateErr.message?.includes('INVALID_TRANSITION')) {
        throw new AppError('INVALID_TRANSITION', `Cannot cancel from ${booking.status}`, 400);
      }
      throw new AppError('CANCEL_FAILED', updateErr.message, 500);
    }

    // 7. Release any active slot locks
    await supabase
      .from('booking_slot_locks')
      .update({ released_at: new Date().toISOString() })
      .eq('booking_id', booking_id)
      .is('released_at', null);

    // 8. Process refund if needed
    if (needsRefund) {
      // Update payment record
      const { data: payment } = await supabase
        .from('payments')
        .select('id, amount_fils')
        .eq('booking_id', booking_id)
        .eq('status', 'succeeded')
        .single();

      if (payment) {
        const refundStatus = refundAmountFils >= payment.amount_fils
          ? 'refunded'
          : 'partially_refunded';

        await supabase
          .from('payments')
          .update({
            status: refundStatus,
            refund_amount_fils: refundAmountFils,
            refunded_at: new Date().toISOString(),
          })
          .eq('id', payment.id);

        // TODO: Trigger actual refund via payment provider API
      }
    }

    // 9. Handle provider penalties for provider-initiated cancellation
    if (cancelledByRole === 'provider' && booking.provider_id) {
      // Increment cancellation count
      await supabase.rpc('increment_provider_cancellations', {
        p_provider_id: booking.provider_id,
      }).catch(() => {
        // Fallback if RPC doesn't exist
        // Will be handled by nightly score recalculation
      });
    }

    // 10. Create notifications
    const notifications = [];

    if (cancelledByRole !== 'customer') {
      // Notify customer
      notifications.push({
        user_id: booking.customer_id,
        channel: 'in_app',
        title: 'Booking Cancelled',
        body: `Your booking ${booking.booking_number} has been cancelled. ${refundAmountFils > 0 ? `Refund of ${refundAmountFils / 100} AED will be processed.` : ''}`,
        data: { booking_id, type: 'booking_cancelled' },
      });
    }

    if (cancelledByRole !== 'provider' && booking.provider_id) {
      // Notify provider
      const { data: providerUser } = await supabase
        .from('providers')
        .select('user_id')
        .eq('id', booking.provider_id)
        .single();

      if (providerUser) {
        notifications.push({
          user_id: providerUser.user_id,
          channel: 'in_app',
          title: 'Booking Cancelled',
          body: `Booking ${booking.booking_number} has been cancelled by the ${cancelledByRole}.`,
          data: { booking_id, type: 'booking_cancelled' },
        });
      }
    }

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    // 11. Log audit
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'booking.cancelled',
      entity_type: 'booking',
      entity_id: booking_id,
      old_data: { status: booking.status },
      new_data: {
        status: cancelStatus,
        reason,
        refund_amount_fils: refundAmountFils,
        refund_percent: refundPercent,
      },
    });

    return jsonResponse({
      booking_id,
      new_status: cancelStatus,
      refund_amount_fils: refundAmountFils,
      refund_percent: refundPercent,
    });

  } catch (error) {
    return errorResponse(error);
  }
});
