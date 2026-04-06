/**
 * Money calculation utilities.
 * All amounts are in fils (1 AED = 100 fils).
 * Never use floating point for money.
 */

const UAE_VAT_BPS = 500; // 5.00% VAT

/**
 * Calculate tax in fils.
 * Uses basis points to avoid floating point.
 */
export function calculateTax(amountFils: number, taxRateBps: number = UAE_VAT_BPS): number {
  return Math.round((amountFils * taxRateBps) / 10000);
}

/**
 * Calculate platform fee in fils from total.
 */
export function calculatePlatformFee(totalFils: number, commissionRateBps: number): number {
  return Math.round((totalFils * commissionRateBps) / 10000);
}

/**
 * Calculate full price breakdown for a booking.
 */
export function calculateBookingPrice(params: {
  servicePriceFils: number;
  discountFils: number;
  taxRateBps?: number;
  commissionRateBps: number;
}): {
  service_price_fils: number;
  discount_fils: number;
  tax_fils: number;
  total_fils: number;
  platform_fee_fils: number;
  provider_payout_fils: number;
} {
  const { servicePriceFils, discountFils, taxRateBps = UAE_VAT_BPS, commissionRateBps } = params;

  const afterDiscount = servicePriceFils - discountFils;
  const taxFils = calculateTax(afterDiscount, taxRateBps);
  const totalFils = afterDiscount + taxFils;
  const platformFeeFils = calculatePlatformFee(totalFils, commissionRateBps);
  const providerPayoutFils = totalFils - platformFeeFils;

  return {
    service_price_fils: servicePriceFils,
    discount_fils: discountFils,
    tax_fils: taxFils,
    total_fils: totalFils,
    platform_fee_fils: platformFeeFils,
    provider_payout_fils: providerPayoutFils,
  };
}

/**
 * Calculate refund amount based on cancellation policy.
 */
export function calculateRefundAmount(
  totalFils: number,
  startTime: Date,
  cancelledByRole: 'customer' | 'provider' | 'admin'
): { refundAmountFils: number; refundPercent: number } {
  // Provider/admin cancellation = full refund
  if (cancelledByRole !== 'customer') {
    return { refundAmountFils: totalFils, refundPercent: 100 };
  }

  const hoursUntilStart = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);

  let refundPercent: number;
  if (hoursUntilStart > 24) refundPercent = 100;
  else if (hoursUntilStart > 12) refundPercent = 50;
  else if (hoursUntilStart > 6) refundPercent = 25;
  else refundPercent = 0;

  const refundAmountFils = Math.round((totalFils * refundPercent) / 100);
  return { refundAmountFils, refundPercent };
}
