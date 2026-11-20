export const colors = {
  bg: '#F3F4F6',
  surface: '#FFFFFF',
  ink: '#15181C',
  muted: '#5B6470',
  border: '#DDE1E6',
  line: '#ECEEF1',
  accent: '#C2410C',
  accentSoft: '#FFF1E8',
  ok: '#14532D',
  okSoft: '#E7F5EC',
  okBorder: '#166534',
  warn: '#713F12',
  warnSoft: '#FEF3C7',
  warnBorder: '#92400E',
  placeholder: '#E4E7EB',
};

export const radius = { sm: 10, md: 12, lg: 14, pill: 22 };

/** Maximum content width on wide (desktop) screens. */
export const MAX_WIDTH = 1240;

/** 85 -> "85 €", 3.5 -> "3,50 €" (Lithuanian number format). */
export function money(value: number): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
  return `${text} €`;
}

/**
 * Buyer protection fee for paying through the platform: 4.5 % of item + delivery, plus 0.45 €.
 * Sized to cover the payment provider's charges and VAT. The server charges the real amount
 * (supabase/functions/payments, PARTAZA_FEE_*); keep the two in step.
 */
/** Platform's administration fee per order paid through the platform, in euros (server: PARTAZA_ADMIN_FEE_CENTS). */
export const ADMIN_FEE = 1;

export function buyerFee(amount: number): number {
  return (Math.round(amount * 4.5) + 45) / 100;
}
