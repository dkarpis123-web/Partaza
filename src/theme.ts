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

/** Buyer protection fee. Placeholder formula (Vinted-like); the real fee is a business decision. */
export function buyerFee(price: number): number {
  return Math.round((0.7 + price * 0.05) * 100) / 100;
}
